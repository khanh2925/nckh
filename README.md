# Airport Indoor Map

Prototype bản đồ sân bay gồm hai phần tách biệt:

```text
React + Leaflet  →  Spring Boot REST API
```

Chưa sử dụng database, đăng nhập hoặc Spring Security. Dữ liệu địa điểm mẫu nằm trong backend để dễ học luồng Controller → JSON → React.

## 1. Chạy backend Spring Boot

Yêu cầu Java 17. Không cần cài Maven vì project có Maven Wrapper.

```bash
cd Back-End
./mvnw spring-boot:run
```

Backend chạy tại `http://localhost:8080`. API kiểm tra:

```text
http://localhost:8080/api/locations
http://localhost:8080/api/locations?floor=1
```

## 2. Chạy frontend React

Mở Terminal thứ hai:

```bash
cd Front-End
npm install
npm run dev
```

Mở URL Vite in ra, mặc định là `http://localhost:5173`.

## Cấu trúc cần học trước

- `Back-End/.../AirportMapApplication.java`: điểm khởi động Spring Boot.
- `Back-End/.../LocationController.java`: REST API trả dữ liệu địa điểm.
- `Back-End/.../Location.java`: cấu trúc một địa điểm.
- `Front-End/src/App.jsx`: giao diện React.
- `Front-End/src/airport-map.js`: Leaflet, tọa độ và cách vẽ mặt bằng.
- `Front-End/vite.config.js`: chuyển tiếp `/api` từ frontend sang backend.

Sau này có thể bổ sung Entity, Repository và MySQL mà không phải viết lại phần bản đồ.
