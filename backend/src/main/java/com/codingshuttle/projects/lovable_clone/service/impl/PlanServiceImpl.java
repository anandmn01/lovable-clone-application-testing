package com.codingshuttle.projects.lovable_clone.service.impl;

import com.codingshuttle.projects.lovable_clone.dto.subscription.PlanResponse;
import com.codingshuttle.projects.lovable_clone.entity.Plan;
import com.codingshuttle.projects.lovable_clone.mapper.SubscriptionMapper;
import com.codingshuttle.projects.lovable_clone.repository.PlanRepository;
import com.codingshuttle.projects.lovable_clone.service.PlanService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlanServiceImpl implements PlanService {

    private final PlanRepository planRepository;
    private final SubscriptionMapper subscriptionMapper;

    @Override
    public List<PlanResponse> getAllActivePlans() {
        List<Plan> plans = planRepository.findByActiveTrue();

        if (plans.isEmpty()) {
            log.info("No active plans found in DB. Seeding default subscription plans...");
            Plan freePlan = Plan.builder()
                    .name("Free Starter")
                    .maxProjects(5)
                    .maxTokensPerDay(25000)
                    .maxPreviews(10)
                    .unlimitedAi(false)
                    .active(true)
                    .stripePriceId(null)
                    .build();

            Plan proPlan = Plan.builder()
                    .name("Pro Developer")
                    .maxProjects(50)
                    .maxTokensPerDay(500000)
                    .maxPreviews(100)
                    .unlimitedAi(true)
                    .active(true)
                    .stripePriceId("price_1QvProPlanMonthly")
                    .build();

            Plan teamPlan = Plan.builder()
                    .name("Team Enterprise")
                    .maxProjects(200)
                    .maxTokensPerDay(2000000)
                    .maxPreviews(500)
                    .unlimitedAi(true)
                    .active(true)
                    .stripePriceId("price_1QvTeamPlanMonthly")
                    .build();

            plans = planRepository.saveAll(List.of(freePlan, proPlan, teamPlan));
        }

        return plans.stream()
                .map(this::mapToPlanResponse)
                .toList();
    }

    private PlanResponse mapToPlanResponse(Plan plan) {
        String displayPrice = "Free";
        if (plan.getName() != null) {
            String lower = plan.getName().toLowerCase();
            if (lower.contains("team") || lower.contains("enterprise")) {
                displayPrice = "$60/mo";
            } else if (lower.contains("pro") || plan.getStripePriceId() != null) {
                displayPrice = "$20/mo";
            }
        }

        return new PlanResponse(
                plan.getId(),
                plan.getName(),
                plan.getMaxProjects(),
                plan.getMaxTokensPerDay(),
                plan.getUnlimitedAi(),
                displayPrice
        );
    }
}
