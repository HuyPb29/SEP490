package com.sep490.bms.repository.feedback;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.feedback.Complaint;

@Repository
public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
}
