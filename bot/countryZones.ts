// Country codes and representative time zones derived from the IANA-backed
// countries-and-timezones dataset. For countries with multiple zones, the
// representative is the country's primary/common zone; country-only input
// cannot identify a player's state or city.
const COUNTRY_ZONE_DATA =
  'AD=Europe/Andorra,AE=Asia/Dubai,AF=Asia/Kabul,AG=America/Puerto_Rico,AI=America/Puerto_Rico,AL=Europe/Tirane,AM=Asia/Yerevan,AO=Africa/Lagos,AQ=Antarctica/Casey,AR=America/Argentina/Buenos_Aires,AS=Pacific/Pago_Pago,AT=Europe/Vienna,AU=Australia/Sydney,AW=America/Puerto_Rico,AX=Europe/Helsinki,AZ=Asia/Baku,BA=Europe/Belgrade,BB=America/Barbados,BD=Asia/Dhaka,BE=Europe/Brussels,BF=Africa/Abidjan,BG=Europe/Sofia,BH=Asia/Qatar,BI=Africa/Maputo,BJ=Africa/Lagos,BL=America/Puerto_Rico,BM=Atlantic/Bermuda,BN=Asia/Kuching,BO=America/La_Paz,BQ=America/Puerto_Rico,BR=America/Sao_Paulo,BS=America/Toronto,BT=Asia/Thimphu,BW=Africa/Maputo,BY=Europe/Minsk,BZ=America/Belize,CA=America/Toronto,CC=Asia/Yangon,CD=Africa/Kinshasa,CF=Africa/Lagos,CG=Africa/Lagos,CH=Europe/Zurich,CI=Africa/Abidjan,CK=Pacific/Rarotonga,CL=America/Santiago,CM=Africa/Lagos,CN=Asia/Shanghai,CO=America/Bogota,CR=America/Costa_Rica,CU=America/Havana,CV=Atlantic/Cape_Verde,CW=America/Puerto_Rico,CX=Asia/Bangkok,CY=Asia/Famagusta,CZ=Europe/Prague,DE=Europe/Berlin,DJ=Africa/Nairobi,DK=Europe/Copenhagen,DM=America/Puerto_Rico,DO=America/Santo_Domingo,DZ=Africa/Algiers,EC=America/Guayaquil,EE=Europe/Tallinn,EG=Africa/Cairo,EH=Africa/El_Aaiun,ER=Africa/Nairobi,ES=Europe/Madrid,ET=Africa/Nairobi,FI=Europe/Helsinki,FJ=Pacific/Fiji,FK=Atlantic/Stanley,FM=Pacific/Guadalcanal,FO=Atlantic/Faroe,FR=Europe/Paris,GA=Africa/Lagos,GB=Europe/London,GD=America/Puerto_Rico,GE=Asia/Tbilisi,GF=America/Cayenne,GG=Europe/London,GH=Africa/Abidjan,GI=Europe/Gibraltar,GL=America/Nuuk,GM=Africa/Abidjan,GN=Africa/Abidjan,GP=America/Puerto_Rico,GQ=Africa/Lagos,GR=Europe/Athens,GS=Atlantic/South_Georgia,GT=America/Guatemala,GU=Pacific/Guam,GW=Africa/Bissau,GY=America/Guyana,HK=Asia/Hong_Kong,HM=Australia/Perth,HN=America/Tegucigalpa,HR=Europe/Belgrade,HT=America/Port-au-Prince,HU=Europe/Budapest,ID=Asia/Jakarta,IE=Europe/Dublin,IL=Asia/Jerusalem,IM=Europe/London,IN=Asia/Kolkata,IO=Indian/Chagos,IQ=Asia/Baghdad,IR=Asia/Tehran,IS=Africa/Abidjan,IT=Europe/Rome,JE=Europe/London,JM=America/Jamaica,JO=Asia/Amman,JP=Asia/Tokyo,KE=Africa/Nairobi,KG=Asia/Bishkek,KH=Asia/Bangkok,KI=Pacific/Kanton,KM=Africa/Nairobi,KN=America/Puerto_Rico,KP=Asia/Pyongyang,KR=Asia/Seoul,KW=Asia/Riyadh,KY=America/Panama,KZ=Asia/Almaty,LA=Asia/Bangkok,LB=Asia/Beirut,LC=America/Puerto_Rico,LI=Europe/Zurich,LK=Asia/Colombo,LR=Africa/Monrovia,LS=Africa/Johannesburg,LT=Europe/Vilnius,LU=Europe/Brussels,LV=Europe/Riga,LY=Africa/Tripoli,MA=Africa/Casablanca,MC=Europe/Paris,MD=Europe/Chisinau,ME=Europe/Belgrade,MF=America/Puerto_Rico,MG=Africa/Nairobi,MH=Pacific/Kwajalein,MK=Europe/Belgrade,ML=Africa/Abidjan,MM=Asia/Yangon,MN=Asia/Hovd,MO=Asia/Macau,MP=Pacific/Guam,MQ=America/Martinique,MR=Africa/Abidjan,MS=America/Puerto_Rico,MT=Europe/Malta,MU=Indian/Mauritius,MV=Indian/Maldives,MW=Africa/Maputo,MX=America/Mexico_City,MY=Asia/Kuala_Lumpur,MZ=Africa/Maputo,NA=Africa/Windhoek,NC=Pacific/Noumea,NE=Africa/Lagos,NF=Pacific/Norfolk,NG=Africa/Lagos,NI=America/Managua,NL=Europe/Amsterdam,NO=Europe/Oslo,NP=Asia/Kathmandu,NR=Pacific/Nauru,NU=Pacific/Niue,NZ=Pacific/Auckland,OM=Asia/Dubai,PA=America/Panama,PE=America/Lima,PF=Pacific/Gambier,PG=Pacific/Bougainville,PH=Asia/Manila,PK=Asia/Karachi,PL=Europe/Warsaw,PM=America/Miquelon,PN=Pacific/Pitcairn,PR=America/Puerto_Rico,PS=Asia/Gaza,PT=Europe/Lisbon,PW=Pacific/Palau,PY=America/Asuncion,QA=Asia/Qatar,RE=Asia/Dubai,RO=Europe/Bucharest,RS=Europe/Belgrade,RU=Europe/Moscow,RW=Africa/Maputo,SA=Asia/Riyadh,SB=Pacific/Guadalcanal,SC=Asia/Dubai,SD=Africa/Khartoum,SE=Europe/Stockholm,SG=Asia/Singapore,SH=Africa/Abidjan,SI=Europe/Belgrade,SJ=Europe/Berlin,SK=Europe/Prague,SL=Africa/Abidjan,SM=Europe/Rome,SN=Africa/Abidjan,SO=Africa/Nairobi,SR=America/Paramaribo,SS=Africa/Juba,ST=Africa/Sao_Tome,SV=America/El_Salvador,SX=America/Puerto_Rico,SY=Asia/Damascus,SZ=Africa/Johannesburg,TC=America/Grand_Turk,TD=Africa/Ndjamena,TF=Asia/Dubai,TG=Africa/Abidjan,TH=Asia/Bangkok,TJ=Asia/Dushanbe,TK=Pacific/Fakaofo,TL=Asia/Dili,TM=Asia/Ashgabat,TN=Africa/Tunis,TO=Pacific/Tongatapu,TR=Europe/Istanbul,TT=America/Puerto_Rico,TV=Pacific/Tarawa,TW=Asia/Taipei,TZ=Africa/Nairobi,UA=Europe/Kyiv,UG=Africa/Nairobi,UM=Pacific/Pago_Pago,US=America/New_York,UY=America/Montevideo,UZ=Asia/Samarkand,VA=Europe/Rome,VC=America/Puerto_Rico,VE=America/Caracas,VG=America/Puerto_Rico,VI=America/Puerto_Rico,VN=Asia/Bangkok,VU=Pacific/Efate,WF=Pacific/Tarawa,WS=Pacific/Apia,YE=Asia/Riyadh,YT=Africa/Nairobi,ZA=Africa/Johannesburg,ZM=Africa/Maputo,ZW=Africa/Maputo';

const countryTimezones = new Map(
  COUNTRY_ZONE_DATA.split(',').map((entry) => {
    const [code, timeZone] = entry.split('=');
    return [code, timeZone] as const;
  }),
);

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

export interface CountryOption {
  code: string;
  name: string;
  timeZone: string;
}

export const COUNTRY_OPTIONS: CountryOption[] = Array.from(countryTimezones, ([code, timeZone]) => ({
  code,
  name: countryNames.of(code) ?? code,
  timeZone,
})).sort((a, b) => a.name.localeCompare(b.name));

export function getCountryOption(code: string): CountryOption | undefined {
  return COUNTRY_OPTIONS.find((country) => country.code === code);
}
