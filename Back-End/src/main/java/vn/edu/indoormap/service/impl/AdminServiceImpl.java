package vn.edu.indoormap.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.indoormap.dto.AuthDtos.UserDto;
import vn.edu.indoormap.dto.VenueDto;
import vn.edu.indoormap.entity.User;
import vn.edu.indoormap.entity.Venue;
import vn.edu.indoormap.exception.ApiException;
import vn.edu.indoormap.mapper.VenueMapper;
import vn.edu.indoormap.repository.UserRepository;
import vn.edu.indoormap.repository.VenueRepository;
import vn.edu.indoormap.security.CurrentUser;
import vn.edu.indoormap.service.AdminService;

import java.util.List;

@Service
@Transactional
public class AdminServiceImpl implements AdminService {
    private final UserRepository users;
    private final VenueRepository venues;
    private final VenueMapper venueMapper;
    private final CurrentUser currentUser;

    public AdminServiceImpl(UserRepository users, VenueRepository venues, VenueMapper venueMapper, CurrentUser currentUser) {
        this.users = users; this.venues = venues; this.venueMapper = venueMapper; this.currentUser = currentUser;
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserDto> listUsers(String status) {
        List<User> list = status == null || status.isBlank()
                ? users.findAllByOrderByCreatedAtDesc()
                : users.findByStatusOrderByCreatedAtDesc(parse(User.Status.class, status));
        return list.stream().map(AuthServiceImpl::toDto).toList();
    }

    // Duyệt (ACTIVE), khoá (LOCKED), mở khoá (ACTIVE)
    @Override
    public UserDto setUserStatus(Long id, String status) {
        User user = users.findById(id).orElseThrow(() -> ApiException.notFound("tài khoản " + id));
        if (user.getId().equals(currentUser.require().getId())) {
            throw ApiException.badRequest("Không thể đổi trạng thái tài khoản của chính mình");
        }
        user.setStatus(parse(User.Status.class, status));
        return AuthServiceImpl.toDto(users.save(user));
    }

    @Override
    @Transactional(readOnly = true)
    public List<VenueDto> listVenues() {
        return venues.findAllByOrderByUpdatedAtDesc().stream().map(venueMapper::toDto).toList();
    }

    // Kiểm duyệt: PUBLISHED (duyệt), HIDDEN (ẩn vi phạm), DRAFT (trả về nháp)
    @Override
    public VenueDto setVenueStatus(Long id, String status) {
        Venue venue = venues.findById(id).orElseThrow(() -> ApiException.notFound("địa điểm " + id));
        venue.setStatus(parse(Venue.Status.class, status));
        return venueMapper.toDto(venues.save(venue));
    }

    // Gán chủ cho địa điểm (ví dụ dữ liệu sân bay chuyển từ v1 chưa có chủ)
    @Override
    public VenueDto setVenueOwner(Long id, Long ownerId) {
        Venue venue = venues.findById(id).orElseThrow(() -> ApiException.notFound("địa điểm " + id));
        User owner = ownerId == null ? null : users.findById(ownerId).orElseThrow(() -> ApiException.notFound("tài khoản " + ownerId));
        venue.setOwner(owner);
        return venueMapper.toDto(venues.save(venue));
    }

    private static <E extends Enum<E>> E parse(Class<E> type, String value) {
        try {
            return Enum.valueOf(type, value.trim().toUpperCase());
        } catch (Exception e) {
            throw ApiException.badRequest("Trạng thái không hợp lệ: " + value);
        }
    }
}
