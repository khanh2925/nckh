package vn.edu.airportmap.dao.impl;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.airportmap.dao.LocationDao;
import vn.edu.airportmap.model.Location;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
@Repository
@Profile("postgres")
@Transactional
public class LocationPostgresDao implements LocationDao {
 private final JdbcTemplate jdbc;
 private final ObjectMapper mapper;
 public LocationPostgresDao(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc=jdbc; this.mapper=mapper; }
 @Override @Transactional(readOnly=true)
 public List<Location> findAll() { return jdbc.query("SELECT * FROM locations ORDER BY id", this::read); }
 @Override @Transactional(readOnly=true)
 public Location findById(Long id) {
  var rows=jdbc.query("SELECT * FROM locations WHERE id = ?",this::read,id);
  return rows.isEmpty()?null:rows.get(0);
 }
 @Override public Location save(Location l) {
  if(l.getId()==null) l.setId(jdbc.queryForObject("INSERT INTO locations (name, type, terminal, floor, x, y, lat, lng, source_id, phone, website, area, description, opening_hours, facilities) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",Long.class,l.getName(), l.getType(), l.getTerminal(), l.getFloor(), l.getX(), l.getY(), l.getLat(), l.getLng(), l.getSourceId(), l.getPhone(), l.getWebsite(), l.getArea(), l.getDescription(), l.getOpeningHours(), encode(l.getFacilities())));
  else jdbc.update("UPDATE locations SET name = ?, type = ?, terminal = ?, floor = ?, x = ?, y = ?, lat = ?, lng = ?, source_id = ?, phone = ?, website = ?, area = ?, description = ?, opening_hours = ?, facilities = ? WHERE id = ?",l.getName(), l.getType(), l.getTerminal(), l.getFloor(), l.getX(), l.getY(), l.getLat(), l.getLng(), l.getSourceId(), l.getPhone(), l.getWebsite(), l.getArea(), l.getDescription(), l.getOpeningHours(), encode(l.getFacilities()),l.getId());
  return l;
 }
 // Importer supplies original IDs inside a single transaction.
 void importLocation(Location l) { jdbc.update("INSERT INTO locations (name, type, terminal, floor, x, y, lat, lng, source_id, phone, website, area, description, opening_hours, facilities,id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)",l.getName(), l.getType(), l.getTerminal(), l.getFloor(), l.getX(), l.getY(), l.getLat(), l.getLng(), l.getSourceId(), l.getPhone(), l.getWebsite(), l.getArea(), l.getDescription(), l.getOpeningHours(), encode(l.getFacilities()),l.getId()); }
 @Override public boolean deleteById(Long id) {return jdbc.update("DELETE FROM locations WHERE id = ?",id)>0;}
 private Location read(ResultSet rs,int row) throws SQLException {
  Location l=new Location(); l.setId(rs.getLong("id"));
  l.setName(rs.getObject("name", String.class));
l.setType(rs.getObject("type", String.class));
l.setTerminal(rs.getObject("terminal", String.class));
l.setFloor(rs.getObject("floor", Integer.class));
l.setX(rs.getObject("x", Double.class));
l.setY(rs.getObject("y", Double.class));
l.setLat(rs.getObject("lat", Double.class));
l.setLng(rs.getObject("lng", Double.class));
l.setSourceId(rs.getObject("source_id", Long.class));
l.setPhone(rs.getObject("phone", String.class));
l.setWebsite(rs.getObject("website", String.class));
l.setArea(rs.getObject("area", String.class));
l.setDescription(rs.getObject("description", String.class));
l.setOpeningHours(rs.getObject("opening_hours", String.class));
l.setFacilities(decode(rs.getString("facilities")));
  return l;
 }
 private String encode(List<String> value) {
  if(value==null)return null;
  try{return mapper.writeValueAsString(value);}catch(java.io.IOException e){throw new IllegalArgumentException("Cannot encode facilities",e);}
 }
 private List<String> decode(String value) {
  if(value==null)return null;
  try{return mapper.readValue(value,new TypeReference<List<String>>(){});}catch(java.io.IOException e){throw new IllegalStateException("Invalid facilities",e);}
 }
}
