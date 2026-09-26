import pois from '../../../crawled_data/tan_son_nhat_full/tan_son_nhat_all_pois.json';
import nodes from '../../../crawled_data/tan_son_nhat_full/tan_son_nhat_all_nodes.json';
import t1 from '../../../crawled_data/tan_son_nhat_full/t1_domestic/t1_domestic_floors.json';
import t2 from '../../../crawled_data/tan_son_nhat_full/t2_international/t2_international_floors.json';
import t3 from '../../../crawled_data/tan_son_nhat_full/t3_domestic/t3_domestic_floors.json';
import campus from '../../../crawled_data/tan_son_nhat_full/overview_campus/overview_campus_floors.json';

const svgFiles = import.meta.glob('../../../crawled_data/tan_son_nhat_full/*/svg_maps/*.svg', { eager: true, query: '?url', import: 'default' });
const groups = { T1: ['t1_domestic', t1], T2: ['t2_international', t2], T3: ['t3_domestic', t3], SGN_CAMPUS: ['overview_campus', campus] };
export const airportTerminals = [
    { id: 'T1', name: 'Ga nội địa T1' }, { id: 'T2', name: 'Ga quốc tế T2' },
    { id: 'T3', name: 'Ga nội địa T3' }, { id: 'SGN_CAMPUS', name: 'Khuôn viên sân bay' }
];
export const airportFloors = Object.entries(groups).flatMap(([terminal, [folder, data]]) =>
    Object.values(data).map(item => ({
        id: Number(item.level), sourceId: String(item.id), terminal,
        name: item.multilingual_name?.vi || item.name,
        bounds: [[item.bounds.sw.lat, item.bounds.sw.lng], [item.bounds.ne.lat, item.bounds.ne.lng]],
        center: item.center ? [item.center.lat, item.center.lng] : [(item.bounds.sw.lat + item.bounds.ne.lat) / 2, (item.bounds.sw.lng + item.bounds.ne.lng) / 2],
        url: Object.entries(svgFiles).find(([path]) => path.includes(`/${folder}/`) && path.includes(`Level${item.level}_`))?.[1]
    }))
);

const typeMap = { 'poi-wc': 'restroom', 'poi-gate': 'gate', 'poi-checkin-counter': 'checkin', 'poi-baggage-claim': 'baggage', 'poi-ticket': 'ticket', 'poi-medical': 'medical', 'poi-smoking': 'smoking', 'poi-staircase': 'staircase', 'poi-escalator': 'escalator', 'poi-elevator': 'elevator', 'poi-lounge': 'lounge', 'poi-info': 'info', 'poi-atm': 'atm', 'poi-duty-free': 'shop', 'poi-passport-control': 'security', 'poi-baggage-check': 'security' };
export const airportLocations = pois.map(poi => ({
    id: `catalog:${poi.poi_id}`, sourceId: poi.poi_id, catalogOnly: true,
    name: poi.name_vi || poi.name_en || poi.name_origin || `Địa điểm ${poi.poi_id}`,
    type: poi.type_name === 'poi-info' ? 'information' : typeMap[poi.type_name] || 'other', sourceType: poi.type_name,
    terminal: poi.terminal_code, floor: Number(poi.floor_level), floorId: String(poi.floor_id),
    lat: poi.lat, lng: poi.lng, phone: poi.phone, website: poi.website,
    openingHours: poi.open_close_at, description: poi.categories || '',
    source: poi
}));
// These are nodes only; the master file does not describe the connecting edges.
export const airportNodes = nodes.map(node => ({ ...node, id: node.node_id, terminal: node.terminal_code, floorId: String(node.floor_id) }));

export function mergeAirportLocations(saved) {
    const key = item => `${item.terminal}|${item.floor}|${Number(item.lat).toFixed(6)}|${Number(item.lng).toFixed(6)}`;
    const stored = new Map(saved.filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng)).map(item => [key(item), item]));
    const used = new Set();
    const result = airportLocations.map(item => {
        const match = stored.get(key(item));
        if (!match) return item;
        used.add(match.id);
        return { ...item, ...match, catalogOnly: false };
    });
    return [...result, ...saved.filter(item => !used.has(item.id))];
}
