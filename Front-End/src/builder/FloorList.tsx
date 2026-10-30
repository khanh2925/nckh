import type { Floor, VenueModel } from "@indoor-map/core";

/** Tên tầng kèm mã toà khi địa điểm có nhiều toà */
export function floorLabel(model: VenueModel, floor: Floor | undefined, sep = " / "): string {
    if (!floor) return "";
    return model.buildings.length > 1 ? `${floor.buildingCode}${sep}${floor.name}` : floor.name;
}
