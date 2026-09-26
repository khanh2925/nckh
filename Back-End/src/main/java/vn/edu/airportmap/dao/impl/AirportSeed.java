package vn.edu.airportmap.dao.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.core.type.TypeReference;
import vn.edu.airportmap.model.Location;
import java.io.File;
import java.io.IOException;
import java.util.*;

/** Import once into the writable store. Subsequent restarts read the saved store only. */
final class AirportSeed {
    static List<Location> read(ObjectMapper mapper) throws IOException {
        File legacyFile = new File("src/main/resources/data/locations.json");
        List<Location> legacy = legacyFile.exists() ? mapper.readValue(legacyFile, new TypeReference<List<Location>>() {}) : new ArrayList<>();
        Map<String, Location> previous = new HashMap<>();
        for (Location place : legacy) if (place.getLat() != null && place.getLng() != null) previous.put(key(place.getTerminal(), place.getFloor(), place.getLat(), place.getLng()), place);
        List<Location> result = new ArrayList<>();
        Set<Long> used = new HashSet<>();
        for (JsonNode poi : mapper.readTree(new File("../crawled_data/tan_son_nhat_full/tan_son_nhat_all_pois.json"))) {
            String terminal = poi.path("terminal_code").asText();
            int floor = poi.path("floor_level").asInt();
            double lat = poi.path("lat").asDouble(), lng = poi.path("lng").asDouble();
            Location place = previous.get(key(terminal, floor, lat, lng));
            if (place == null || used.contains(place.getId())) {
                place = new Location();
                place.setId(poi.path("poi_id").asLong());
                String name = poi.path("name_vi").asText("");
                if (name.isBlank()) name = poi.path("name_en").asText("");
                if (name.isBlank()) name = poi.path("name_origin").asText("");
                if (name.isBlank()) name = "Địa điểm " + place.getId();
                place.setName(name);
                String type = switch (poi.path("type_name").asText("")) {
                    case "poi-wc" -> "restroom"; case "poi-gate" -> "gate";
                    case "poi-checkin-counter" -> "checkin"; case "poi-baggage-claim" -> "baggage";
                    case "poi-ticket" -> "ticket"; case "poi-medical" -> "medical";
                    case "poi-smoking" -> "smoking"; case "poi-staircase" -> "staircase";
                    case "poi-escalator" -> "escalator"; case "poi-elevator" -> "elevator";
                    case "poi-info" -> "information"; case "poi-atm" -> "atm";
                    case "poi-lounge" -> "lounge"; case "poi-duty-free" -> "shop";
                    case "poi-passport-control", "poi-baggage-check" -> "security";
                    default -> "other";
                };
                place.setType(type); place.setTerminal(terminal); place.setFloor(floor);
                place.setLat(lat); place.setLng(lng);
                place.setDescription(poi.path("categories").asText(""));
                place.setOpeningHours(poi.path("open_close_at").asText(""));
            }
            place.setSourceId(poi.path("poi_id").asLong());
            place.setPhone(poi.path("phone").asText(""));
            place.setWebsite(poi.path("website").asText(""));
            result.add(place); used.add(place.getId());
        }
        for (Location place : legacy) if (!used.contains(place.getId())) result.add(place);
        return result;
    }
    private static String key(String terminal, int floor, double lat, double lng) {
        return String.format(Locale.ROOT, "%s|%d|%.6f|%.6f", terminal, floor, lat, lng);
    }
}
