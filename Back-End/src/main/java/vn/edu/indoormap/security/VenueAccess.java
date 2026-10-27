package vn.edu.indoormap.security;

import org.springframework.stereotype.Component;
import vn.edu.indoormap.entity.User;
import vn.edu.indoormap.entity.Venue;
import vn.edu.indoormap.exception.ApiException;
import vn.edu.indoormap.repository.VenueRepository;

// Quy tắc truy cập địa điểm:
// - đọc: ai cũng đọc được địa điểm PUBLISHED; DRAFT/HIDDEN chỉ chủ địa điểm và quản trị hệ thống
// - sửa: chủ địa điểm hoặc quản trị hệ thống
@Component
public class VenueAccess {
    private final VenueRepository venues;
    private final CurrentUser currentUser;

    public VenueAccess(VenueRepository venues, CurrentUser currentUser) {
        this.venues = venues;
        this.currentUser = currentUser;
    }

    public Venue readable(Long venueId) {
        Venue venue = venues.findById(venueId).orElseThrow(() -> ApiException.notFound("địa điểm " + venueId));
        return checkReadable(venue);
    }

    public Venue readableBySlug(String slug) {
        Venue venue = venues.findBySlug(slug).orElseThrow(() -> ApiException.notFound("địa điểm " + slug));
        return checkReadable(venue);
    }

    public Venue editable(Long venueId) {
        Venue venue = venues.findById(venueId).orElseThrow(() -> ApiException.notFound("địa điểm " + venueId));
        if (!canEdit(venue)) {
            throw ApiException.forbidden("Bạn không phải chủ của địa điểm này");
        }
        return venue;
    }

    public boolean canEdit(Venue venue) {
        User user = currentUser.get().orElse(null);
        if (user == null) {
            return false;
        }
        if (user.getRole() == User.Role.SYSTEM_ADMIN) {
            return true;
        }
        return venue.getOwner() != null && venue.getOwner().getId().equals(user.getId());
    }

    private Venue checkReadable(Venue venue) {
        if (venue.getStatus() == Venue.Status.PUBLISHED || canEdit(venue)) {
            return venue;
        }
        throw ApiException.notFound("địa điểm " + venue.getSlug());
    }
}
