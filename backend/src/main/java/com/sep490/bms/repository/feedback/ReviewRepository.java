package com.sep490.bms.repository.feedback;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.feedback.Review;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Long> {
}
