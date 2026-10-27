package vn.edu.indoormap.service;

import vn.edu.indoormap.dto.AuthDtos.*;

public interface AuthService {
    LoginResponse login(LoginRequest request, String clientAddress);
    UserDto register(RegisterRequest request);
    UserDto me();
    UserDto updateProfile(UpdateProfileRequest request);
    void changePassword(ChangePasswordRequest request);
}
