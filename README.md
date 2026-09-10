# Airport Indoor Map — Jakarta EE

Prototype bản đồ sân bay trong nhà cho môn Lập trình WWW.

## Công nghệ

- Java 17
- Jakarta Servlet 6.0
- JSP, Maven và Apache Tomcat 10.1+
- Leaflet và JavaScript thuần

## Chạy project

```bash
mvn clean package
```

Copy `target/airport-map.war` vào thư mục `webapps` của Tomcat, khởi động Tomcat rồi mở:

```text
http://localhost:8080/airport-map/airport-map
```

Nếu chạy trực tiếp từ IDE với context path khác:

```text
http://localhost:8080/<context-path>/airport-map
```

## Cấu trúc chính

- Servlet: `src/main/java/vn/edu/airportmap/web/AirportMapServlet.java`
- JSP: `src/main/webapp/WEB-INF/views/airport-map.jsp`
- JavaScript và dữ liệu mẫu: `src/main/webapp/js/airport-map.js`
- CSS: `src/main/webapp/css/airport-map.css`
- Mặt bằng rời trong tương lai: `src/main/webapp/images/maps/`

Mặt bằng T1 hiện được dựng bằng SVG từ JavaScript để giữ phép xoay và căn tọa độ với bản đồ nền. Dữ liệu địa điểm mẫu nằm trong hằng `locations`; sau này có thể thay bằng dữ liệu trả về từ Servlet hoặc REST API.
