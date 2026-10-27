package vn.edu.indoormap.dto;

import java.util.List;

// Kết quả nhập hàng loạt địa điểm
public record ImportResultDto(int imported, int skipped, List<String> errors) {}
