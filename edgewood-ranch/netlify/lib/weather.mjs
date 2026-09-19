// Turns a National Weather Service station observation into the handful of skies the 3D ranch
// can draw: clear, partly, cloudy, rain, storm, snow or fog.

const COVER = { SKC: 0, CLR: 0, NCD: 0, NSC: 0, FEW: 0.2, SCT: 0.45, BKN: 0.75, OVC: 1, VV: 1 };

/** @param {object} props the `properties` of an api.weather.gov observation */
export function skyFrom(props) {
  const words = [
    ...(props.presentWeather ?? []).map((w) => `${w.intensity ?? ''} ${w.weather ?? ''}`),
    props.textDescription ?? '',
  ].join(' ').toLowerCase();
  const cloud = Math.max(0, ...(props.cloudLayers ?? []).map((layer) => COVER[layer.amount] ?? 0));
  let kind = 'clear';
  if (/thunder/.test(words)) kind = 'storm';
  else if (/snow|sleet|ice pellets|graupel|hail|freezing/.test(words)) kind = 'snow';
  else if (/rain|drizzle|shower/.test(words)) kind = 'rain';
  else if (/fog|mist|haze|smoke/.test(words)) kind = 'fog';
  else if (cloud >= 0.75 || /overcast|mostly cloudy|^cloudy/.test(words.trim())) kind = 'cloudy';
  else if (cloud >= 0.3 || /partly|mostly clear/.test(words)) kind = 'partly';
  const temp = props.temperature?.value;
  return {
    kind,
    description: props.textDescription || null,
    tempF: typeof temp === 'number' ? Math.round(temp * 1.8 + 32) : null,
    observed: props.timestamp ?? null,
  };
}
