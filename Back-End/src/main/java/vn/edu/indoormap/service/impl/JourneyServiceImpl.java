package vn.edu.indoormap.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.indoormap.dto.JourneyDto;
import vn.edu.indoormap.entity.Journey;
import vn.edu.indoormap.entity.JourneyQuestion;
import vn.edu.indoormap.entity.JourneyStep;
import vn.edu.indoormap.entity.Venue;
import vn.edu.indoormap.exception.ApiException;
import vn.edu.indoormap.repository.JourneyRepository;
import vn.edu.indoormap.repository.LocationRepository;
import vn.edu.indoormap.repository.LocationTypeRepository;
import vn.edu.indoormap.security.VenueAccess;
import vn.edu.indoormap.service.JourneyService;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@Transactional
public class JourneyServiceImpl implements JourneyService {
    static final int MIN_STEPS = 2, MAX_STEPS = 15, MAX_QUESTIONS = 3, MAX_INSTRUCTION = 280;

    private final JourneyRepository journeys;
    private final LocationRepository locations;
    private final LocationTypeRepository types;
    private final VenueAccess access;

    public JourneyServiceImpl(JourneyRepository journeys, LocationRepository locations, LocationTypeRepository types, VenueAccess access) {
        this.journeys = journeys; this.locations = locations; this.types = types; this.access = access;
    }

    // Chủ địa điểm thấy cả bản nháp; người khác chỉ thấy quy trình đã công khai
    @Override
    @Transactional(readOnly = true)
    public List<JourneyDto> list(Long venueId) {
        Venue venue = access.readable(venueId);
        return (access.canEdit(venue) ? journeys.findByVenue_IdOrderBySortOrderAscIdAsc(venueId) : publishedOf(venueId))
                .stream().map(this::toDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<JourneyDto> published(Long venueId) {
        return publishedOf(venueId).stream().map(this::toDto).toList();
    }

    @Override
    public JourneyDto create(Long venueId, JourneyDto dto) {
        Venue venue = access.editable(venueId);
        Journey j = Journey.builder().venue(venue).build();
        apply(venueId, dto, j);
        return toDto(journeys.save(j));
    }

    @Override
    public JourneyDto update(Long venueId, Long id, JourneyDto dto) {
        access.editable(venueId);
        Journey j = find(venueId, id);
        apply(venueId, dto, j);
        return toDto(journeys.save(j));
    }

    @Override
    public void delete(Long venueId, Long id) {
        access.editable(venueId);
        journeys.delete(find(venueId, id));
    }

    @Override
    @Transactional(readOnly = true)
    public void checkLocationUnused(Long venueId, Long locationId) {
        for (Journey j : publishedOf(venueId)) {
            if (j.getSteps().stream().anyMatch(s -> locationId.equals(s.getTargetLocationId()))) {
                throw ApiException.conflict("Điểm này là một bước của quy trình công khai \"" + j.getName() + "\". Đổi đích của bước hoặc chuyển quy trình về nháp trước.");
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public void checkTypeUnused(Long venueId, String typeCode) {
        for (Journey j : publishedOf(venueId)) {
            if (j.getSteps().stream().anyMatch(s -> typeCode.equals(s.getTargetType()))) {
                throw ApiException.conflict("Loại này là đích của một bước trong quy trình công khai \"" + j.getName() + "\". Đổi đích của bước hoặc chuyển quy trình về nháp trước.");
            }
        }
    }

    private List<Journey> publishedOf(Long venueId) {
        return journeys.findByVenue_IdAndStatusOrderBySortOrderAscIdAsc(venueId, Journey.Status.PUBLISHED);
    }

    private Journey find(Long venueId, Long id) {
        return journeys.findByIdAndVenue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("quy trình " + id));
    }

    // Bản nháp lưu được khi còn dở (bước chưa chọn đích); công khai thì phải đủ quy tắc BR-30
    private void apply(Long venueId, JourneyDto dto, Journey j) {
        Journey.Status status = dto.getStatus() == null ? j.getStatus() : parseStatus(dto.getStatus());
        List<JourneyQuestion> questions = dto.getQuestions() == null ? List.of() : dto.getQuestions();
        List<JourneyStep> steps = dto.getSteps() == null ? List.of() : dto.getSteps();

        if (questions.size() > MAX_QUESTIONS) throw ApiException.badRequest("Tối đa " + MAX_QUESTIONS + " câu hỏi");
        Set<String> questionIds = new HashSet<>();
        for (JourneyQuestion q : questions) {
            if (q.getId() == null || q.getId().isBlank() || q.getText() == null || q.getText().isBlank()) {
                throw ApiException.badRequest("Câu hỏi cần có mã và nội dung");
            }
            if (!questionIds.add(q.getId())) throw ApiException.badRequest("Mã câu hỏi bị trùng: " + q.getId());
        }
        if (steps.size() > MAX_STEPS) throw ApiException.badRequest("Quy trình có tối đa " + MAX_STEPS + " bước");
        for (int i = 0; i < steps.size(); i++) {
            JourneyStep s = steps.get(i);
            String at = "Bước " + (i + 1);
            if (s.getTitle() == null || s.getTitle().isBlank()) throw ApiException.badRequest(at + " cần có tên");
            if (s.getInstruction() != null && s.getInstruction().length() > MAX_INSTRUCTION) {
                throw ApiException.badRequest(at + ": hướng dẫn tối đa " + MAX_INSTRUCTION + " ký tự");
            }
            if (s.getTargetType() != null && s.getTargetType().isBlank()) s.setTargetType(null);
            if (s.getTargetLocationId() != null && s.getTargetType() != null) {
                throw ApiException.badRequest(at + ": chọn một điểm hoặc một loại, không chọn cả hai");
            }
            if (s.getTargetLocationId() != null && locations.findByIdAndFloor_Building_Venue_Id(s.getTargetLocationId(), venueId).isEmpty()) {
                throw ApiException.badRequest(at + ": điểm đích không thuộc địa điểm này");
            }
            if (s.getTargetType() != null && types.findByVenue_IdAndCode(venueId, s.getTargetType()).isEmpty()) {
                throw ApiException.badRequest(at + ": loại '" + s.getTargetType() + "' chưa có ở địa điểm này");
            }
            if (s.getDwellMinutes() != null && (s.getDwellMinutes() < 0 || s.getDwellMinutes() > 600)) {
                throw ApiException.badRequest(at + ": thời gian ở bước không hợp lệ");
            }
            if (s.getSkipIf() == null) s.setSkipIf(new ArrayList<>());
            for (JourneyStep.SkipIf c : s.getSkipIf()) {
                if (!questionIds.contains(c.getQuestionId())) throw ApiException.badRequest(at + ": điều kiện bỏ qua trỏ tới câu hỏi không có");
            }
        }
        if (status == Journey.Status.PUBLISHED) {
            if (steps.size() < MIN_STEPS) throw ApiException.badRequest("Cần ít nhất " + MIN_STEPS + " bước để công khai");
            for (int i = 0; i < steps.size(); i++) {
                JourneyStep s = steps.get(i);
                if (s.getTargetLocationId() == null && s.getTargetType() == null) {
                    throw ApiException.badRequest("Bước " + (i + 1) + " chưa chọn nơi đến, chưa công khai được");
                }
            }
        }
        j.setName(dto.getName().trim());
        j.setDescription(dto.getDescription());
        j.setIcon(dto.getIcon());
        j.setStatus(status);
        if (dto.getSortOrder() != null) j.setSortOrder(dto.getSortOrder());
        j.setQuestions(new ArrayList<>(questions));
        j.setSteps(new ArrayList<>(steps));
    }

    private static Journey.Status parseStatus(String s) {
        try {
            return Journey.Status.valueOf(s.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Trạng thái không hợp lệ: " + s);
        }
    }

    private JourneyDto toDto(Journey j) {
        return JourneyDto.builder().id(j.getId()).name(j.getName()).description(j.getDescription()).icon(j.getIcon())
                .status(j.getStatus().name()).sortOrder(j.getSortOrder()).questions(j.getQuestions()).steps(j.getSteps())
                .updatedAt(j.getUpdatedAt()).build();
    }
}
