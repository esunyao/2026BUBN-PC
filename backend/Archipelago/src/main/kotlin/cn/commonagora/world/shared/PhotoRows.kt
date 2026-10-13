package cn.commonagora.world.shared

import org.springframework.jdbc.core.RowMapper

object PhotoRows {
    val mapper = RowMapper<PhotoDto> { rs, _ ->
        PhotoDto(
            id = rs.getString("id"), filename = rs.getString("filename"),
            caption = rs.getString("caption"), photographerId = rs.getString("photographer_id"),
            islandId = rs.getString("island_id"),
            gps = if (rs.getObject("latitude") == null) null else Gps(rs.getDouble("latitude"), rs.getDouble("longitude")),
            capturedAt = if (rs.getObject("captured_at") == null) null else rs.getLong("captured_at"),
            importOrder = rs.getInt("import_order")
        )
    }
}
