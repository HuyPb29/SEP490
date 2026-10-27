package com.sep490.bms.repository.team;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sep490.bms.entity.team.Team;

public interface TeamRepository extends JpaRepository<Team, Long> {

    boolean existsByNameIgnoreCase(String name);

    @Query("SELECT t FROM Team t WHERE :search IS NULL OR LOWER(t.name) LIKE LOWER(CONCAT('%', :search, '%')) ORDER BY t.name")
    List<Team> search(@Param("search") String search);

    @Query("SELECT t FROM Team t WHERE t.id IN (SELECT m.teamId FROM TeamMember m WHERE m.playerId = :playerId AND m.status = com.sep490.bms.entity.team.TeamMemberStatus.ACTIVE) ORDER BY t.name")
    List<Team> findByActiveMember(@Param("playerId") Long playerId);
}
