// Finn.no location codes for the search's `location` parameter. Generated from the filter data
// embedded in https://www.finn.no/realestate/homes/search.html — county codes are `0.<id>`,
// municipalities (and Oslo's districts) `1.<county>.<id>`. Regenerate if Finn renumbers.

export interface FinnLocation {
	code: string;
	name: string;
}

export interface FinnCounty extends FinnLocation {
	children: FinnLocation[];
}

export const FINN_COUNTIES: FinnCounty[] = [
	{
		code: '0.22042',
		name: 'Agder',
		children: [
			{
				code: '1.22042.20166',
				name: 'Arendal'
			},
			{
				code: '1.22042.20172',
				name: 'Birkenes'
			},
			{
				code: '1.22042.20176',
				name: 'Bygland'
			},
			{
				code: '1.22042.20178',
				name: 'Bykle'
			},
			{
				code: '1.22042.20175',
				name: 'Evje og Hornnes'
			},
			{
				code: '1.22042.20181',
				name: 'Farsund'
			},
			{
				code: '1.22042.20182',
				name: 'Flekkefjord'
			},
			{
				code: '1.22042.20170',
				name: 'Froland'
			},
			{
				code: '1.22042.20167',
				name: 'Gjerstad'
			},
			{
				code: '1.22042.20165',
				name: 'Grimstad'
			},
			{
				code: '1.22042.20191',
				name: 'Hægebostad'
			},
			{
				code: '1.22042.20174',
				name: 'Iveland'
			},
			{
				code: '1.22042.20179',
				name: 'Kristiansand'
			},
			{
				code: '1.22042.20192',
				name: 'Kvinesdal'
			},
			{
				code: '1.22042.20171',
				name: 'Lillesand'
			},
			{
				code: '1.22042.20189',
				name: 'Lindesnes'
			},
			{
				code: '1.22042.20190',
				name: 'Lyngdal'
			},
			{
				code: '1.22042.20164',
				name: 'Risør'
			},
			{
				code: '1.22042.20193',
				name: 'Sirdal'
			},
			{
				code: '1.22042.20169',
				name: 'Tvedestrand'
			},
			{
				code: '1.22042.20177',
				name: 'Valle'
			},
			{
				code: '1.22042.20168',
				name: 'Vegårshei'
			},
			{
				code: '1.22042.20183',
				name: 'Vennesla'
			},
			{
				code: '1.22042.20173',
				name: 'Åmli'
			},
			{
				code: '1.22042.20187',
				name: 'Åseral'
			}
		]
	},
	{
		code: '0.20003',
		name: 'Akershus',
		children: [
			{
				code: '1.20003.20046',
				name: 'Asker'
			},
			{
				code: '1.20003.20047',
				name: 'Aurskog-Høland'
			},
			{
				code: '1.20003.20045',
				name: 'Bærum'
			},
			{
				code: '1.20003.20058',
				name: 'Eidsvoll'
			},
			{
				code: '1.20003.20051',
				name: 'Enebakk'
			},
			{
				code: '1.20003.20042',
				name: 'Frogn - Drøbak'
			},
			{
				code: '1.20003.20055',
				name: 'Gjerdrum'
			},
			{
				code: '1.20003.20060',
				name: 'Hurdal'
			},
			{
				code: '1.20003.20099',
				name: 'Jevnaker'
			},
			{
				code: '1.20003.22105',
				name: 'Lillestrøm'
			},
			{
				code: '1.20003.20100',
				name: 'Lunner'
			},
			{
				code: '1.20003.20052',
				name: 'Lørenskog'
			},
			{
				code: '1.20003.20059',
				name: 'Nannestad'
			},
			{
				code: '1.20003.20057',
				name: 'Nes'
			},
			{
				code: '1.20003.20043',
				name: 'Nesodden'
			},
			{
				code: '1.20003.20054',
				name: 'Nittedal'
			},
			{
				code: '1.20003.22104',
				name: 'Nordre Follo'
			},
			{
				code: '1.20003.20050',
				name: 'Rælingen'
			},
			{
				code: '1.20003.20056',
				name: 'Ullensaker'
			},
			{
				code: '1.20003.20039',
				name: 'Vestby'
			},
			{
				code: '1.20003.20041',
				name: 'Ås'
			}
		]
	},
	{
		code: '0.20007',
		name: 'Buskerud',
		children: [
			{
				code: '1.20007.20110',
				name: 'Drammen'
			},
			{
				code: '1.20007.20128',
				name: 'Flesberg'
			},
			{
				code: '1.20007.20114',
				name: 'Flå'
			},
			{
				code: '1.20007.20116',
				name: 'Gol'
			},
			{
				code: '1.20007.20117',
				name: 'Hemsedal'
			},
			{
				code: '1.20007.20119',
				name: 'Hol'
			},
			{
				code: '1.20007.20113',
				name: 'Hole'
			},
			{
				code: '1.20007.20111',
				name: 'Kongsberg'
			},
			{
				code: '1.20007.20121',
				name: 'Krødsherad'
			},
			{
				code: '1.20007.20125',
				name: 'Lier'
			},
			{
				code: '1.20007.20122',
				name: 'Modum'
			},
			{
				code: '1.20007.20115',
				name: 'Nesbyen'
			},
			{
				code: '1.20007.20130',
				name: 'Nore og Uvdal'
			},
			{
				code: '1.20007.20112',
				name: 'Ringerike'
			},
			{
				code: '1.20007.20129',
				name: 'Rollag'
			},
			{
				code: '1.20007.20120',
				name: 'Sigdal'
			},
			{
				code: '1.20007.20123',
				name: 'Øvre Eiker'
			},
			{
				code: '1.20007.20118',
				name: 'Ål'
			}
		]
	},
	{
		code: '0.20020',
		name: 'Finnmark',
		children: [
			{
				code: '1.20020.20441',
				name: 'Alta'
			},
			{
				code: '1.20020.20451',
				name: 'Berlevåg'
			},
			{
				code: '1.20020.20454',
				name: 'Båtsfjord'
			},
			{
				code: '1.20020.20450',
				name: 'Gamvik'
			},
			{
				code: '1.20020.20439',
				name: 'Hammerfest'
			},
			{
				code: '1.20020.20443',
				name: 'Hasvik'
			},
			{
				code: '1.20020.20448',
				name: 'Karasjok'
			},
			{
				code: '1.20020.20440',
				name: 'Kautokeino'
			},
			{
				code: '1.20020.20449',
				name: 'Lebesby'
			},
			{
				code: '1.20020.20442',
				name: 'Loppa'
			},
			{
				code: '1.20020.20445',
				name: 'Måsøy'
			},
			{
				code: '1.20020.20453',
				name: 'Nesseby'
			},
			{
				code: '1.20020.20446',
				name: 'Nordkapp'
			},
			{
				code: '1.20020.20447',
				name: 'Porsanger'
			},
			{
				code: '1.20020.20455',
				name: 'Sør-Varanger'
			},
			{
				code: '1.20020.20452',
				name: 'Tana'
			},
			{
				code: '1.20020.20438',
				name: 'Vadsø'
			},
			{
				code: '1.20020.20437',
				name: 'Vardø'
			}
		]
	},
	{
		code: '0.22034',
		name: 'Innlandet',
		children: [
			{
				code: '1.22034.20081',
				name: 'Alvdal'
			},
			{
				code: '1.22034.20086',
				name: 'Dovre'
			},
			{
				code: '1.22034.20069',
				name: 'Eidskog'
			},
			{
				code: '1.22034.20073',
				name: 'Elverum'
			},
			{
				code: '1.22034.20078',
				name: 'Engerdal'
			},
			{
				code: '1.22034.20105',
				name: 'Etnedal'
			},
			{
				code: '1.22034.20082',
				name: 'Folldal'
			},
			{
				code: '1.22034.20096',
				name: 'Gausdal'
			},
			{
				code: '1.22034.20085',
				name: 'Gjøvik'
			},
			{
				code: '1.22034.20101',
				name: 'Gran'
			},
			{
				code: '1.22034.20070',
				name: 'Grue'
			},
			{
				code: '1.22034.20063',
				name: 'Hamar'
			},
			{
				code: '1.22034.20099',
				name: 'Jevnaker'
			},
			{
				code: '1.22034.20062',
				name: 'Kongsvinger'
			},
			{
				code: '1.22034.20087',
				name: 'Lesja'
			},
			{
				code: '1.22034.20084',
				name: 'Lillehammer'
			},
			{
				code: '1.22034.20089',
				name: 'Lom'
			},
			{
				code: '1.22034.20100',
				name: 'Lunner'
			},
			{
				code: '1.22034.20065',
				name: 'Løten'
			},
			{
				code: '1.22034.20106',
				name: 'Nord-Aurdal'
			},
			{
				code: '1.22034.20091',
				name: 'Nord-Fron'
			},
			{
				code: '1.22034.20067',
				name: 'Nord-Odal'
			},
			{
				code: '1.22034.20103',
				name: 'Nordre Land'
			},
			{
				code: '1.22034.20083',
				name: 'Os (Innlandet)'
			},
			{
				code: '1.22034.20077',
				name: 'Rendalen'
			},
			{
				code: '1.22034.20094',
				name: 'Ringebu'
			},
			{
				code: '1.22034.20064',
				name: 'Ringsaker'
			},
			{
				code: '1.22034.20092',
				name: 'Sel'
			},
			{
				code: '1.22034.20088',
				name: 'Skjåk'
			},
			{
				code: '1.22034.20066',
				name: 'Stange'
			},
			{
				code: '1.22034.20076',
				name: 'Stor-Elvdal'
			},
			{
				code: '1.22034.20102',
				name: 'Søndre Land'
			},
			{
				code: '1.22034.20104',
				name: 'Sør-Aurdal'
			},
			{
				code: '1.22034.20093',
				name: 'Sør-Fron'
			},
			{
				code: '1.22034.20068',
				name: 'Sør-Odal'
			},
			{
				code: '1.22034.20079',
				name: 'Tolga'
			},
			{
				code: '1.22034.20074',
				name: 'Trysil'
			},
			{
				code: '1.22034.20080',
				name: 'Tynset'
			},
			{
				code: '1.22034.20109',
				name: 'Vang'
			},
			{
				code: '1.22034.20107',
				name: 'Vestre Slidre'
			},
			{
				code: '1.22034.20098',
				name: 'Vestre Toten'
			},
			{
				code: '1.22034.20090',
				name: 'Vågå'
			},
			{
				code: '1.22034.20072',
				name: 'Våler (Innlandet)'
			},
			{
				code: '1.22034.20097',
				name: 'Østre Toten'
			},
			{
				code: '1.22034.20095',
				name: 'Øyer'
			},
			{
				code: '1.22034.20108',
				name: 'Øystre Slidre'
			},
			{
				code: '1.22034.20075',
				name: 'Åmot'
			},
			{
				code: '1.22034.20071',
				name: 'Åsnes'
			}
		]
	},
	{
		code: '0.20015',
		name: 'Møre og Romsdal',
		children: [
			{
				code: '1.20015.20304',
				name: 'Aukra'
			},
			{
				code: '1.20015.20314',
				name: 'Aure'
			},
			{
				code: '1.20015.20307',
				name: 'Averøy'
			},
			{
				code: '1.20015.22101',
				name: 'Fjord'
			},
			{
				code: '1.20015.20297',
				name: 'Giske'
			},
			{
				code: '1.20015.20309',
				name: 'Gjemnes'
			},
			{
				code: '1.20015.20298',
				name: 'Haram'
			},
			{
				code: '1.20015.20287',
				name: 'Hareid'
			},
			{
				code: '1.20015.20285',
				name: 'Herøy (M.R.)'
			},
			{
				code: '1.20015.22102',
				name: 'Hustadvika'
			},
			{
				code: '1.20015.20281',
				name: 'Kristiansund'
			},
			{
				code: '1.20015.20280',
				name: 'Molde'
			},
			{
				code: '1.20015.20300',
				name: 'Rauma'
			},
			{
				code: '1.20015.20284',
				name: 'Sande (M.R.)'
			},
			{
				code: '1.20015.20317',
				name: 'Smøla'
			},
			{
				code: '1.20015.20292',
				name: 'Stranda'
			},
			{
				code: '1.20015.20296',
				name: 'Sula'
			},
			{
				code: '1.20015.20311',
				name: 'Sunndal'
			},
			{
				code: '1.20015.20312',
				name: 'Surnadal'
			},
			{
				code: '1.20015.20294',
				name: 'Sykkylven'
			},
			{
				code: '1.20015.20310',
				name: 'Tingvoll'
			},
			{
				code: '1.20015.20286',
				name: 'Ulstein'
			},
			{
				code: '1.20015.20283',
				name: 'Vanylven'
			},
			{
				code: '1.20015.20299',
				name: 'Vestnes'
			},
			{
				code: '1.20015.20288',
				name: 'Volda'
			},
			{
				code: '1.20015.20289',
				name: 'Ørsta'
			},
			{
				code: '1.20015.20282',
				name: 'Ålesund'
			}
		]
	},
	{
		code: '0.20018',
		name: 'Nordland',
		children: [
			{
				code: '1.20018.20375',
				name: 'Alstahaug'
			},
			{
				code: '1.20018.20410',
				name: 'Andøy'
			},
			{
				code: '1.20018.20389',
				name: 'Beiarn'
			},
			{
				code: '1.20018.20369',
				name: 'Bindal'
			},
			{
				code: '1.20018.20367',
				name: 'Bodø'
			},
			{
				code: '1.20018.20371',
				name: 'Brønnøy'
			},
			{
				code: '1.20018.20407',
				name: 'Bø (Nordland)'
			},
			{
				code: '1.20018.20380',
				name: 'Dønna'
			},
			{
				code: '1.20018.20399',
				name: 'Evenes'
			},
			{
				code: '1.20018.20391',
				name: 'Fauske'
			},
			{
				code: '1.20018.20403',
				name: 'Flakstad'
			},
			{
				code: '1.20018.20388',
				name: 'Gildeskål'
			},
			{
				code: '1.20018.20378',
				name: 'Grane'
			},
			{
				code: '1.20018.20406',
				name: 'Hadsel'
			},
			{
				code: '1.20018.20395',
				name: 'Hamarøy'
			},
			{
				code: '1.20018.20379',
				name: 'Hattfjelldal'
			},
			{
				code: '1.20018.20382',
				name: 'Hemnes'
			},
			{
				code: '1.20018.20374',
				name: 'Herøy (Nordland)'
			},
			{
				code: '1.20018.20376',
				name: 'Leirfjord'
			},
			{
				code: '1.20018.20384',
				name: 'Lurøy'
			},
			{
				code: '1.20018.20397',
				name: 'Lødingen'
			},
			{
				code: '1.20018.20387',
				name: 'Meløy'
			},
			{
				code: '1.20018.20411',
				name: 'Moskenes'
			},
			{
				code: '1.20018.20368',
				name: 'Narvik'
			},
			{
				code: '1.20018.20381',
				name: 'Nesna'
			},
			{
				code: '1.20018.20383',
				name: 'Rana'
			},
			{
				code: '1.20018.20386',
				name: 'Rødøy'
			},
			{
				code: '1.20018.20401',
				name: 'Røst'
			},
			{
				code: '1.20018.20390',
				name: 'Saltdal'
			},
			{
				code: '1.20018.20409',
				name: 'Sortland'
			},
			{
				code: '1.20018.20394',
				name: 'Steigen'
			},
			{
				code: '1.20018.20370',
				name: 'Sømna'
			},
			{
				code: '1.20018.20393',
				name: 'Sørfold'
			},
			{
				code: '1.20018.20385',
				name: 'Træna'
			},
			{
				code: '1.20018.20377',
				name: 'Vefsn'
			},
			{
				code: '1.20018.20372',
				name: 'Vega'
			},
			{
				code: '1.20018.20404',
				name: 'Vestvågøy'
			},
			{
				code: '1.20018.20373',
				name: 'Vevelstad'
			},
			{
				code: '1.20018.20402',
				name: 'Værøy'
			},
			{
				code: '1.20018.20405',
				name: 'Vågan'
			},
			{
				code: '1.20018.20408',
				name: 'Øksnes'
			}
		]
	},
	{
		code: '0.20061',
		name: 'Oslo',
		children: [
			{
				code: '1.20061.20528',
				name: 'Bjerke'
			},
			{
				code: '1.20061.20507',
				name: 'Bygdøy - Frogner'
			},
			{
				code: '1.20061.20519',
				name: 'Bøler'
			},
			{
				code: '1.20061.20515',
				name: 'Ekeberg - Bekkelaget'
			},
			{
				code: '1.20061.20524',
				name: 'Furuset'
			},
			{
				code: '1.20061.20512',
				name: 'Gamle Oslo'
			},
			{
				code: '1.20061.20529',
				name: 'Grefsen - Kjelsås'
			},
			{
				code: '1.20061.20527',
				name: 'Grorud'
			},
			{
				code: '1.20061.20511',
				name: 'Grünerløkka - Sofienberg'
			},
			{
				code: '1.20061.20523',
				name: 'Hellerud'
			},
			{
				code: '1.20061.20522',
				name: 'Helsfyr - Sinsen'
			},
			{
				code: '1.20061.20518',
				name: 'Lambertseter'
			},
			{
				code: '1.20061.20520',
				name: 'Manglerud'
			},
			{
				code: '1.20061.20514',
				name: 'Marka'
			},
			{
				code: '1.20061.20516',
				name: 'Nordstrand'
			},
			{
				code: '1.20061.20526',
				name: 'Romsås'
			},
			{
				code: '1.20061.20532',
				name: 'Røa'
			},
			{
				code: '1.20061.20510',
				name: 'Sagene - Torshov'
			},
			{
				code: '1.20061.20513',
				name: 'Sentrum'
			},
			{
				code: '1.20061.20530',
				name: 'Sogn'
			},
			{
				code: '1.20061.20509',
				name: 'St.Hanshaugen - Ullevål'
			},
			{
				code: '1.20061.20525',
				name: 'Stovner'
			},
			{
				code: '1.20061.20517',
				name: 'Søndre Nordstrand'
			},
			{
				code: '1.20061.20533',
				name: 'Ullern'
			},
			{
				code: '1.20061.20508',
				name: 'Uranienborg - Majorstuen'
			},
			{
				code: '1.20061.20531',
				name: 'Vinderen'
			},
			{
				code: '1.20061.20521',
				name: 'Østensjø'
			}
		]
	},
	{
		code: '0.20012',
		name: 'Rogaland',
		children: [
			{
				code: '1.20012.20200',
				name: 'Bjerkreim'
			},
			{
				code: '1.20012.20215',
				name: 'Bokn'
			},
			{
				code: '1.20012.20194',
				name: 'Eigersund'
			},
			{
				code: '1.20012.20204',
				name: 'Gjesdal'
			},
			{
				code: '1.20012.20197',
				name: 'Haugesund'
			},
			{
				code: '1.20012.20209',
				name: 'Hjelmeland'
			},
			{
				code: '1.20012.20201',
				name: 'Hå'
			},
			{
				code: '1.20012.20217',
				name: 'Karmøy'
			},
			{
				code: '1.20012.20202',
				name: 'Klepp'
			},
			{
				code: '1.20012.20214',
				name: 'Kvitsøy'
			},
			{
				code: '1.20012.20199',
				name: 'Lund'
			},
			{
				code: '1.20012.20206',
				name: 'Randaberg'
			},
			{
				code: '1.20012.20195',
				name: 'Sandnes'
			},
			{
				code: '1.20012.20211',
				name: 'Sauda'
			},
			{
				code: '1.20012.20198',
				name: 'Sokndal'
			},
			{
				code: '1.20012.20205',
				name: 'Sola'
			},
			{
				code: '1.20012.20196',
				name: 'Stavanger'
			},
			{
				code: '1.20012.20208',
				name: 'Strand'
			},
			{
				code: '1.20012.20210',
				name: 'Suldal'
			},
			{
				code: '1.20012.20203',
				name: 'Time'
			},
			{
				code: '1.20012.20216',
				name: 'Tysvær'
			},
			{
				code: '1.20012.20218',
				name: 'Utsira'
			},
			{
				code: '1.20012.20219',
				name: 'Vindafjord'
			}
		]
	},
	{
		code: '0.20506',
		name: 'Svalbard',
		children: []
	},
	{
		code: '0.20009',
		name: 'Telemark',
		children: [
			{
				code: '1.20009.20150',
				name: 'Bamble'
			},
			{
				code: '1.20009.20152',
				name: 'Drangedal'
			},
			{
				code: '1.20009.20161',
				name: 'Fyresdal'
			},
			{
				code: '1.20009.20157',
				name: 'Hjartdal'
			},
			{
				code: '1.20009.20151',
				name: 'Kragerø'
			},
			{
				code: '1.20009.20159',
				name: 'Kviteseid'
			},
			{
				code: '1.20009.22106',
				name: 'Midt-Telemark'
			},
			{
				code: '1.20009.20160',
				name: 'Nissedal'
			},
			{
				code: '1.20009.20153',
				name: 'Nome'
			},
			{
				code: '1.20009.20148',
				name: 'Notodden'
			},
			{
				code: '1.20009.20146',
				name: 'Porsgrunn'
			},
			{
				code: '1.20009.20158',
				name: 'Seljord'
			},
			{
				code: '1.20009.20149',
				name: 'Siljan'
			},
			{
				code: '1.20009.20147',
				name: 'Skien'
			},
			{
				code: '1.20009.20156',
				name: 'Tinn'
			},
			{
				code: '1.20009.20162',
				name: 'Tokke'
			},
			{
				code: '1.20009.20163',
				name: 'Vinje'
			}
		]
	},
	{
		code: '0.20019',
		name: 'Troms',
		children: [
			{
				code: '1.20019.20429',
				name: 'Balsfjord'
			},
			{
				code: '1.20019.20420',
				name: 'Bardu'
			},
			{
				code: '1.20019.20424',
				name: 'Dyrøy'
			},
			{
				code: '1.20019.20418',
				name: 'Gratangen'
			},
			{
				code: '1.20019.20412',
				name: 'Harstad'
			},
			{
				code: '1.20019.20417',
				name: 'Ibestad'
			},
			{
				code: '1.20019.20430',
				name: 'Karlsøy'
			},
			{
				code: '1.20019.20414',
				name: 'Kvæfjord'
			},
			{
				code: '1.20019.20436',
				name: 'Kvænangen'
			},
			{
				code: '1.20019.20433',
				name: 'Kåfjord'
			},
			{
				code: '1.20019.20419',
				name: 'Lavangen'
			},
			{
				code: '1.20019.20431',
				name: 'Lyngen'
			},
			{
				code: '1.20019.20422',
				name: 'Målselv'
			},
			{
				code: '1.20019.20435',
				name: 'Nordreisa'
			},
			{
				code: '1.20019.20421',
				name: 'Salangen'
			},
			{
				code: '1.20019.22115',
				name: 'Senja'
			},
			{
				code: '1.20019.20434',
				name: 'Skjervøy'
			},
			{
				code: '1.20019.20432',
				name: 'Storfjord'
			},
			{
				code: '1.20019.20423',
				name: 'Sørreisa'
			},
			{
				code: '1.20019.20398',
				name: 'Tjeldsund'
			},
			{
				code: '1.20019.20413',
				name: 'Tromsø'
			}
		]
	},
	{
		code: '0.20016',
		name: 'Trøndelag',
		children: [
			{
				code: '1.20016.20363',
				name: 'Flatanger'
			},
			{
				code: '1.20016.20347',
				name: 'Frosta'
			},
			{
				code: '1.20016.20322',
				name: 'Frøya'
			},
			{
				code: '1.20016.20359',
				name: 'Grong'
			},
			{
				code: '1.20016.22112',
				name: 'Heim'
			},
			{
				code: '1.20016.20321',
				name: 'Hitra'
			},
			{
				code: '1.20016.20335',
				name: 'Holtålen'
			},
			{
				code: '1.20016.20360',
				name: 'Høylandet'
			},
			{
				code: '1.20016.20354',
				name: 'Inderøy'
			},
			{
				code: '1.20016.20325',
				name: 'Indre Fosen'
			},
			{
				code: '1.20016.20366',
				name: 'Leka'
			},
			{
				code: '1.20016.20349',
				name: 'Levanger'
			},
			{
				code: '1.20016.20356',
				name: 'Lierne'
			},
			{
				code: '1.20016.20340',
				name: 'Malvik'
			},
			{
				code: '1.20016.20337',
				name: 'Melhus'
			},
			{
				code: '1.20016.20345',
				name: 'Meråker'
			},
			{
				code: '1.20016.20336',
				name: 'Midtre Gauldal'
			},
			{
				code: '1.20016.20344',
				name: 'Namsos'
			},
			{
				code: '1.20016.20358',
				name: 'Namsskogan'
			},
			{
				code: '1.20016.22114',
				name: 'Nærøysund'
			},
			{
				code: '1.20016.20330',
				name: 'Oppdal'
			},
			{
				code: '1.20016.22113',
				name: 'Orkland'
			},
			{
				code: '1.20016.20329',
				name: 'Osen'
			},
			{
				code: '1.20016.20361',
				name: 'Overhalla'
			},
			{
				code: '1.20016.20331',
				name: 'Rennebu'
			},
			{
				code: '1.20016.20313',
				name: 'Rindal'
			},
			{
				code: '1.20016.20334',
				name: 'Røros'
			},
			{
				code: '1.20016.20357',
				name: 'Røyrvik'
			},
			{
				code: '1.20016.20341',
				name: 'Selbu'
			},
			{
				code: '1.20016.20338',
				name: 'Skaun'
			},
			{
				code: '1.20016.20355',
				name: 'Snåsa'
			},
			{
				code: '1.20016.20343',
				name: 'Steinkjer'
			},
			{
				code: '1.20016.20346',
				name: 'Stjørdal'
			},
			{
				code: '1.20016.20318',
				name: 'Trondheim'
			},
			{
				code: '1.20016.20342',
				name: 'Tydal'
			},
			{
				code: '1.20016.20350',
				name: 'Verdal'
			},
			{
				code: '1.20016.20323',
				name: 'Ørland'
			},
			{
				code: '1.20016.20327',
				name: 'Åfjord'
			}
		]
	},
	{
		code: '0.20008',
		name: 'Vestfold',
		children: [
			{
				code: '1.20008.20143',
				name: 'Færder'
			},
			{
				code: '1.20008.20132',
				name: 'Holmestrand'
			},
			{
				code: '1.20008.20131',
				name: 'Horten'
			},
			{
				code: '1.20008.20135',
				name: 'Larvik'
			},
			{
				code: '1.20008.20134',
				name: 'Sandefjord'
			},
			{
				code: '1.20008.20133',
				name: 'Tønsberg'
			}
		]
	},
	{
		code: '0.22046',
		name: 'Vestland',
		children: [
			{
				code: '1.22046.22109',
				name: 'Alver'
			},
			{
				code: '1.22046.20267',
				name: 'Askvoll'
			},
			{
				code: '1.22046.20243',
				name: 'Askøy'
			},
			{
				code: '1.22046.20263',
				name: 'Aurland'
			},
			{
				code: '1.22046.20240',
				name: 'Austevoll'
			},
			{
				code: '1.22046.20251',
				name: 'Austrheim'
			},
			{
				code: '1.22046.20220',
				name: 'Bergen'
			},
			{
				code: '1.22046.22108',
				name: 'Bjørnafjorden'
			},
			{
				code: '1.22046.20273',
				name: 'Bremanger'
			},
			{
				code: '1.22046.20224',
				name: 'Bømlo'
			},
			{
				code: '1.22046.20232',
				name: 'Eidfjord'
			},
			{
				code: '1.22046.20221',
				name: 'Etne'
			},
			{
				code: '1.22046.20252',
				name: 'Fedje'
			},
			{
				code: '1.22046.20226',
				name: 'Fitjar'
			},
			{
				code: '1.22046.20268',
				name: 'Fjaler'
			},
			{
				code: '1.22046.20278',
				name: 'Gloppen'
			},
			{
				code: '1.22046.20255',
				name: 'Gulen'
			},
			{
				code: '1.22046.20257',
				name: 'Hyllestad'
			},
			{
				code: '1.22046.20258',
				name: 'Høyanger'
			},
			{
				code: '1.22046.22107',
				name: 'Kinn'
			},
			{
				code: '1.22046.20236',
				name: 'Kvam'
			},
			{
				code: '1.22046.20228',
				name: 'Kvinnherad'
			},
			{
				code: '1.22046.20266',
				name: 'Luster'
			},
			{
				code: '1.22046.20264',
				name: 'Lærdal'
			},
			{
				code: '1.22046.20253',
				name: 'Masfjorden'
			},
			{
				code: '1.22046.20245',
				name: 'Modalen'
			},
			{
				code: '1.22046.20246',
				name: 'Osterøy'
			},
			{
				code: '1.22046.20238',
				name: 'Samnanger'
			},
			{
				code: '1.22046.20262',
				name: 'Sogndal'
			},
			{
				code: '1.22046.20256',
				name: 'Solund'
			},
			{
				code: '1.22046.22111',
				name: 'Stad'
			},
			{
				code: '1.22046.20225',
				name: 'Stord'
			},
			{
				code: '1.22046.20279',
				name: 'Stryn'
			},
			{
				code: '1.22046.22110',
				name: 'Sunnfjord'
			},
			{
				code: '1.22046.20223',
				name: 'Sveio'
			},
			{
				code: '1.22046.20227',
				name: 'Tysnes'
			},
			{
				code: '1.22046.20231',
				name: 'Ullensvang'
			},
			{
				code: '1.22046.20233',
				name: 'Ulvik'
			},
			{
				code: '1.22046.20244',
				name: 'Vaksdal'
			},
			{
				code: '1.22046.20259',
				name: 'Vik'
			},
			{
				code: '1.22046.20235',
				name: 'Voss'
			},
			{
				code: '1.22046.20248',
				name: 'Øygarden'
			},
			{
				code: '1.22046.20265',
				name: 'Årdal'
			}
		]
	},
	{
		code: '0.20002',
		name: 'Østfold',
		children: [
			{
				code: '1.20002.20026',
				name: 'Aremark'
			},
			{
				code: '1.20002.20024',
				name: 'Fredrikstad'
			},
			{
				code: '1.20002.20021',
				name: 'Halden'
			},
			{
				code: '1.20002.20025',
				name: 'Hvaler'
			},
			{
				code: '1.20002.22103',
				name: 'Indre Østfold'
			},
			{
				code: '1.20002.20027',
				name: 'Marker'
			},
			{
				code: '1.20002.20022',
				name: 'Moss'
			},
			{
				code: '1.20002.20034',
				name: 'Rakkestad'
			},
			{
				code: '1.20002.20035',
				name: 'Råde'
			},
			{
				code: '1.20002.20023',
				name: 'Sarpsborg'
			},
			{
				code: '1.20002.20033',
				name: 'Skiptvet'
			},
			{
				code: '1.20002.20037',
				name: 'Våler (Østfold)'
			}
		]
	}
];
