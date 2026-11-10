<?php
/*
 * CARUNO — VIN decoder, PHP port of scripts/parts/vin_decoder.py (same rules, read from data/vin_rules.json, which
 * scripts/parts/vin_rules.py generates from the Python file: the Python file stays the only source).
 * Checked against the Python answers (data/vin_cases.json) by provisioning/tests/vehicles-api.mjs.
 *
 * The decoder never invents a model: when it is not sure it returns several candidates (or the whole make).
 */
class CarunoVin
{
	private static $rules = null;

	public static function rules()
	{
		if (self::$rules === null) {
			$raw = @file_get_contents(dirname(__DIR__).'/data/vin_rules.json');
			self::$rules = $raw ? json_decode($raw, true) : null;
			if (!is_array(self::$rules)) {
				throw new Exception('VIN rules missing (data/vin_rules.json)');
			}
		}
		return self::$rules;
	}

	/** Spaces, dashes, dots removed; upper case; I -> 1, O / Q -> 0. */
	public static function normalize($raw)
	{
		$v = strtoupper(preg_replace('/[\s\-\.]/u', '', (string) $raw));
		return strtr($v, array('I' => '1', 'O' => '0', 'Q' => '0'));
	}

	/** Char 9 check digit. Mandatory in North America only: informative here. */
	public static function checkDigitOk($vin)
	{
		$r = self::rules();
		$total = 0;
		for ($i = 0; $i < 17; $i++) {
			$total += $r['translit'][$vin[$i]] * $r['weights'][$i];
		}
		$expected = ($total % 11 == 10) ? 'X' : (string) ($total % 11);
		return $vin[8] === $expected;
	}

	/** Model years for char 10, most recent first (30-year cycle). */
	public static function modelYears($code, $today)
	{
		$r = self::rules();
		$pos = strpos($r['year_codes'], $code);
		if ($code === '' || $pos === false) {
			return array();
		}
		$base = 1980 + $pos;
		$out = array();
		foreach (array($base + 30, $base) as $y) {
			if ($y >= 1980 && $y <= $today + 1) {
				$out[] = $y;
			}
		}
		return $out;
	}

	/** array(maker, source): hand-written table first (always wins), then NHTSA (6-char key first), then 2-char prefixes. */
	public static function makerFromWmi($vin)
	{
		$r = self::rules();
		$w3 = substr($vin, 0, 3);
		if (isset($r['wmi'][$w3])) {
			return array($r['wmi'][$w3], 'hand');
		}
		$w6 = $w3.substr($vin, 11, 3);
		if ($vin[2] === '9' && isset($r['wmi_nhtsa'][$w6])) {
			return array($r['wmi_nhtsa'][$w6], 'nhtsa');
		}
		if (isset($r['wmi_nhtsa'][$w3])) {
			return array($r['wmi_nhtsa'][$w3], 'nhtsa');
		}
		$w2 = substr($vin, 0, 2);
		if (isset($r['wmi_prefix2'][$w2])) {
			return array($r['wmi_prefix2'][$w2], 'hand');
		}
		return array(null, null);
	}

	public static function decode($raw, $today = null)
	{
		$r = self::rules();
		$today = $today ?: (int) date('Y');
		$vin = self::normalize($raw);
		$out = array('vin' => $vin, 'valid' => false, 'errors' => array(), 'maker' => null, 'maker_source' => null,
			'years' => array(), 'year_confidence' => null, 'model_hints' => array(), 'mercedes_series' => null,
			'check_digit_ok' => null);
		if (strlen($vin) != 17) {
			$out['errors'][] = 'Le VIN doit contenir 17 caractères (ici '.strlen($vin).').';
			return $out;
		}
		if (!preg_match('/^[A-HJ-NPR-Z0-9]{17}$/', $vin)) {
			$out['errors'][] = 'Caractères non valides : seulement lettres (sauf I, O, Q) et chiffres.';
			return $out;
		}
		$out['valid'] = true;
		$out['check_digit_ok'] = self::checkDigitOk($vin);
		list($maker, $out['maker_source']) = self::makerFromWmi($vin);
		$out['maker'] = $maker;
		if (!$maker) {
			$out['errors'][] = 'Constructeur non reconnu : choisissez la marque manuellement.';
			return $out;
		}
		$reliable = in_array($maker, $r['year_reliable'], true);
		if ($reliable || in_array($maker, $r['year_maybe'], true)) {
			$out['years'] = self::modelYears($vin[9], $today);
			$out['year_confidence'] = $reliable ? 'high' : 'medium';
		}
		if (in_array($maker, $r['vag'], true)) {
			$code = substr($vin, 6, 2);
			$out['model_hints'] = isset($r['vag_codes'][$code]) ? $r['vag_codes'][$code] : array();
		} elseif ($maker === 'MERCEDES-BENZ' && ctype_digit(substr($vin, 3, 3))) {
			$out['mercedes_series'] = substr($vin, 3, 3);   // "204" -> W204 / S204 / X204
		}
		return $out;
	}

	private static function yearFits($m, $years)
	{
		if (!$years || $m['year_from'] === null) {
			return true;
		}
		$end = $m['year_to'] !== null ? $m['year_to'] : 9999;
		foreach ($years as $y) {
			if ($m['year_from'] - 1 <= $y && $y <= $end + 1) {   // model year can be 1 year ahead of production start
				return true;
			}
		}
		return false;
	}

	/**
	 * Catalogue models matching a decoded VIN. $models: rows {id, maker, name, generation, year_from, year_to}
	 * of the decoded maker (BMW for Mini). -> {level: exact|model|make|none, candidates: [...], year}
	 */
	public static function matchModels($decoded, $models)
	{
		$maker = $decoded['maker'];
		$pool = array();
		foreach ($models as $m) {
			$mini = strpos($m['name'], 'Mini') === 0;
			if ($maker === 'MINI' ? ($m['maker'] === 'BMW' && $mini) : ($m['maker'] === $maker && !$mini)) {
				$pool[] = $m;
			}
		}
		if (!$pool) {
			return array('level' => 'none', 'candidates' => array(), 'year' => null);
		}
		$res = self::match($decoded, $pool);
		$res['year'] = null;
		foreach ($decoded['years'] as $y) {
			foreach ($res['candidates'] as $c) {
				if (self::yearFits($c, array($y))) {
					$res['year'] = $y;
					break 2;
				}
			}
		}
		if ($res['year']) {   // keep the most recent cycle only (2014, not 1984)
			$y = $res['year'];
			$res['candidates'] = array_values(array_filter($res['candidates'], function ($c) use ($y) {
				return CarunoVin::yearFitsPublic($c, $y);
			}));
			if ($res['level'] === 'model' && count($res['candidates']) == 1) {
				$res['level'] = 'exact';
			}
		}
		return $res;
	}

	public static function yearFitsPublic($m, $y)
	{
		return self::yearFits($m, array($y));
	}

	private static function match($decoded, $pool)
	{
		$r = self::rules();
		$hits = array();
		if ($decoded['model_hints']) {
			foreach ($decoded['model_hints'] as $h) {
				foreach ($pool as $m) {
					if ($m['name'] === $h[0] && ($h[1] === '' || (string) $m['generation'] === $h[1])) {
						$hits[] = $m;
					}
				}
			}
		} elseif ($decoded['mercedes_series']) {
			$s = $decoded['mercedes_series'];
			foreach ($pool as $m) {
				if (preg_match('/\b[A-Z]{1,2}'.$s.'\b/u', (string) $m['generation'])) {
					$hits[] = $m;
				}
			}
			$suv = in_array(substr($decoded['vin'], 0, 3), $r['mb_suv_wmi'], true);
			$pref = array_values(array_filter($hits, function ($m) use ($r, $suv) {
				$isSuv = false;
				foreach ($r['mb_suv_names'] as $p) {
					if (strpos($m['name'], $p) === 0) {
						$isSuv = true;
					}
				}
				return $isSuv === $suv;
			}));
			$hits = $pref ?: $hits;
		}
		if ($hits) {
			$byYear = array_values(array_filter($hits, function ($m) use ($decoded) {
				return CarunoVin::yearFitsList($m, $decoded['years']);
			}));
			$byYear = $byYear ?: $hits;
			return array('level' => count($byYear) == 1 ? 'exact' : 'model', 'candidates' => $byYear);
		}
		$byYear = array_values(array_filter($pool, function ($m) use ($decoded) {
			return CarunoVin::yearFitsList($m, $decoded['years']);
		}));
		$list = $byYear ?: $pool;
		usort($list, function ($a, $b) {
			return strcmp($a['name'], $b['name']) ?: strcmp((string) $a['generation'], (string) $b['generation']);
		});
		return array('level' => 'make', 'candidates' => $list);
	}

	public static function yearFitsList($m, $years)
	{
		return self::yearFits($m, $years);
	}
}
