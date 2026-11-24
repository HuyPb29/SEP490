package com.sep490.bms.repository.feedback;
import org.springframework.data.jpa.repository.JpaRepository;
import com.sep490.bms.entity.feedback.ComplaintEvidence;

/** Truy cập ảnh khiếu nại bằng mã khiếu nại sau khi service kiểm tra quyền. */
public interface ComplaintEvidenceRepository extends JpaRepository<ComplaintEvidence, Long> {}
