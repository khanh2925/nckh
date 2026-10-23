package vn.edu.airportmap.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.airportmap.dto.LocationDto;
import vn.edu.airportmap.entity.*;
import vn.edu.airportmap.mapper.LocationMapper;
import vn.edu.airportmap.repository.*;
import vn.edu.airportmap.service.LocationService;

import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class LocationServiceImpl implements LocationService {
    private final LocationRepository locationRepository;
    private final TerminalRepository terminalRepository;
    private final FloorRepository floorRepository;
    private final LocationTypeRepository locationTypeRepository;
    private final FacilityRepository facilityRepository;
    private final LocationMapper locationMapper;

    public LocationServiceImpl(LocationRepository locationRepository, TerminalRepository terminalRepository,
                               FloorRepository floorRepository, LocationTypeRepository locationTypeRepository,
                               FacilityRepository facilityRepository, LocationMapper locationMapper) {
        this.locationRepository = locationRepository;
        this.terminalRepository = terminalRepository;
        this.floorRepository = floorRepository;
        this.locationTypeRepository = locationTypeRepository;
        this.facilityRepository = facilityRepository;
        this.locationMapper = locationMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LocationDto> getLocations(Integer floor) {
        List<Location> locations = floor == null
                ? locationRepository.findAllByOrderByIdAsc()
                : locationRepository.findByFloor_LevelOrderByIdAsc(floor);
        return locations.stream().map(locationMapper::toDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public LocationDto getLocationById(Long id) {
        return locationRepository.findWithDetailsById(id).map(locationMapper::toDto).orElse(null);
    }

    @Override
    public LocationDto addLocation(LocationDto location) {
        Location entity = new Location();
        apply(location, entity);
        return locationMapper.toDto(locationRepository.save(entity));
    }

    // Returns null when the id does not exist
    @Override
    public LocationDto updateLocation(Long id, LocationDto location) {
        return locationRepository.findById(id)
                .map(entity -> {
                    apply(location, entity);
                    return locationMapper.toDto(locationRepository.save(entity));
                })
                .orElse(null);
    }

    @Override
    public boolean deleteLocation(Long id) {
        if (!locationRepository.existsById(id)) {
            return false;
        }
        locationRepository.deleteById(id);
        return true;
    }

    private void apply(LocationDto dto, Location entity) {
        if (dto.getTerminal() == null || dto.getTerminal().isBlank() || dto.getFloor() == null) {
            throw new IllegalArgumentException("Terminal and floor are required");
        }
        locationMapper.updateEntity(dto, entity);
        entity.setFloor(findOrCreateFloor(dto.getTerminal(), dto.getFloor()));
        entity.setType(dto.getType() == null ? null : findOrCreateType(dto.getType()));
        entity.setFacilitiesKnown(dto.getFacilities() != null);

        // A new list makes Hibernate delete the old join rows before inserting the new order
        List<Facility> facilities = new ArrayList<>();
        if (dto.getFacilities() != null) {
            for (String name : dto.getFacilities()) {
                if (name == null || name.isBlank()) {
                    throw new IllegalArgumentException("Facility name must not be blank");
                }
                facilities.add(findOrCreateFacility(name));
            }
        }
        entity.setFacilities(facilities);
    }

    // The API may introduce new terminals, floors, types and facilities, so they are registered on first use
    private Floor findOrCreateFloor(String terminalCode, Integer level) {
        Terminal terminal = terminalRepository.findById(terminalCode)
                .orElseGet(() -> terminalRepository.save(new Terminal(terminalCode, terminalCode)));
        return floorRepository.findByTerminal_CodeAndLevel(terminalCode, level)
                .orElseGet(() -> floorRepository.save(Floor.builder()
                        .terminal(terminal)
                        .level(level)
                        .name(level == 0 ? "Tầng trệt" : "Tầng " + level)
                        .build()));
    }

    private LocationType findOrCreateType(String code) {
        return locationTypeRepository.findById(code)
                .orElseGet(() -> locationTypeRepository.save(new LocationType(code, code)));
    }

    private Facility findOrCreateFacility(String name) {
        return facilityRepository.findByName(name)
                .orElseGet(() -> facilityRepository.save(Facility.builder().name(name).build()));
    }
}
