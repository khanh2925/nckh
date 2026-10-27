package vn.edu.indoormap.service;

import vn.edu.indoormap.dto.AuthDtos.UserDto;
import vn.edu.indoormap.dto.VenueDto;

import java.util.List;

// Quản trị hệ thống: tài khoản, kiểm duyệt địa điểm
public interface AdminService {
    List<UserDto> listUsers(String status);
    UserDto setUserStatus(Long id, String status);
    List<VenueDto> listVenues();
    VenueDto setVenueStatus(Long id, String status);
    VenueDto setVenueOwner(Long id, Long ownerId);
}
