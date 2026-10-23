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
