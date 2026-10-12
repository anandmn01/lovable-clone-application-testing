package com.codingshuttle.projects.lovable_clone.service.impl;

import com.codingshuttle.projects.lovable_clone.dto.project.ProjectRequest;
import com.codingshuttle.projects.lovable_clone.dto.project.ProjectResponse;
import com.codingshuttle.projects.lovable_clone.dto.project.ProjectSummaryResponse;
import com.codingshuttle.projects.lovable_clone.entity.Project;
import com.codingshuttle.projects.lovable_clone.entity.ProjectMember;
import com.codingshuttle.projects.lovable_clone.entity.ProjectMemberId;
import com.codingshuttle.projects.lovable_clone.entity.User;
import com.codingshuttle.projects.lovable_clone.enums.ProjectRole;
import com.codingshuttle.projects.lovable_clone.error.BadRequestException;
import com.codingshuttle.projects.lovable_clone.error.ResourceNotFoundException;
import com.codingshuttle.projects.lovable_clone.mapper.ProjectMapper;
import com.codingshuttle.projects.lovable_clone.repository.ProjectMemberRepository;
import com.codingshuttle.projects.lovable_clone.repository.ProjectRepository;
import com.codingshuttle.projects.lovable_clone.repository.UserRepository;
import com.codingshuttle.projects.lovable_clone.security.AuthUtil;
import com.codingshuttle.projects.lovable_clone.service.ProjectService;
import com.codingshuttle.projects.lovable_clone.service.ProjectTemplateService;
import com.codingshuttle.projects.lovable_clone.service.SubscriptionService;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(makeFinal = true, level = AccessLevel.PRIVATE)
@Transactional
public class ProjectServiceImpl implements ProjectService {

    ProjectRepository projectRepository;
    UserRepository userRepository;
    ProjectMapper projectMapper;
    ProjectMemberRepository projectMemberRepository;
    AuthUtil authUtil;
    SubscriptionService subscriptionService;
    ProjectTemplateService projectTemplateService;

    @Override
    public ProjectResponse createProject(ProjectRequest request) {

        if(!subscriptionService.canCreateNewProject()) {
            throw new BadRequestException("User cannot create a New project with current Plan, Upgrade plan now.");
        }

        Long userId = authUtil.getCurrentUserId();
//        User owner = userRepository.findById(userId).orElseThrow(
//                () -> new ResourceNotFoundException("User", userId.toString())
//        );
        User owner = userRepository.getReferenceById(userId);

        Project project = Project.builder()
                .name(request.name())
                .isPublic(false)
                .build();
        project = projectRepository.save(project);

        ProjectMemberId projectMemberId = new ProjectMemberId(project.getId(), owner.getId());
        ProjectMember projectMember = ProjectMember.builder()
                .id(projectMemberId)
                .projectRole(ProjectRole.OWNER)
                .user(owner)
                .acceptedAt(Instant.now())
                .invitedAt(Instant.now())
                .project(project)
                .build();
        projectMemberRepository.save(projectMember);

        projectTemplateService.initializeProjectFromTemplate(project.getId());

        return projectMapper.toProjectResponse(project);
    }

    @Override
    public List<ProjectSummaryResponse> getUserProjects() {
        Long userId = authUtil.getCurrentUserId();
        var projectsWithRoles = projectRepository.findAllAccessibleByUser(userId);
        return projectsWithRoles.stream()
                .map(p -> projectMapper.toProjectSummaryResponse(p.getProject(), p.getRole()))
                .toList();
    }

    @Override
    @PreAuthorize("@security.canViewProject(#projectId)")
    public ProjectSummaryResponse getUserProjectById(Long projectId) {
        Long userId = authUtil.getCurrentUserId();

        var projectWithRole = projectRepository.findAccessibleProjectByIdWithRole(projectId, userId)
                .orElseThrow(() -> new BadRequestException("Project Not Found"));

        return projectMapper.toProjectSummaryResponse(projectWithRole.getProject(), projectWithRole.getRole());
    }

    @Override
    @PreAuthorize("@security.canEditProject(#projectId)")
    public ProjectResponse updateProject(Long projectId, ProjectRequest request) {
        Long userId = authUtil.getCurrentUserId();
        Project project = getAccessibleProjectById(projectId, userId);

        project.setName(request.name());
        project = projectRepository.save(project);

        return projectMapper.toProjectResponse(project);
    }

    @Override
    @PreAuthorize("@security.canDeleteProject(#projectId)")
    public void softDelete(Long projectId) {
        Long userId = authUtil.getCurrentUserId();
        Project project = getAccessibleProjectById(projectId, userId);

        project.setDeletedAt(Instant.now());
        projectRepository.save(project);
    }

    @Override
    public String getProjectPreviewHtml(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId.toString()));

        String projectName = project.getName() != null ? project.getName() : "Project " + projectId;

        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <title>%s Preview</title>
                  <script src="https://cdn.tailwindcss.com"></script>
                  <style>
                    body {
                      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    }
                  </style>
                </head>
                <body class="bg-slate-900 text-slate-100 min-h-screen flex flex-col items-center justify-center p-6">
                  <div class="max-w-md w-full bg-slate-800/80 backdrop-blur border border-slate-700/60 rounded-2xl p-6 shadow-2xl text-center space-y-5">
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Preview Live
                    </div>

                    <h1 class="text-2xl font-bold tracking-tight text-white">%s</h1>
                    <p class="text-sm text-slate-400">
                      This is the live sandboxed preview of your project. Code changes made via the AI assistant will be reflected here.
                    </p>

                    <!-- Interactive Demo Counter Component -->
                    <div class="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4 flex items-center justify-between">
                      <span class="text-sm font-medium text-slate-300">Interactive Counter</span>
                      <div class="flex items-center gap-3">
                        <button onclick="updateCount(-1)" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold transition-all">-</button>
                        <span id="counter" class="text-lg font-bold text-indigo-400 w-6">0</span>
                        <button onclick="updateCount(1)" class="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center font-bold transition-all">+</button>
                      </div>
                    </div>

                    <!-- Test Runtime Error Trigger -->
                    <div class="pt-2 border-t border-slate-700/50 flex flex-col gap-2">
                      <button onclick="triggerTestError()" class="w-full text-xs py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all font-medium">
                        Simulate Runtime Error (Test Auto-Fix)
                      </button>
                    </div>
                  </div>

                  <script>
                    let count = 0;
                    function updateCount(delta) {
                      count += delta;
                      document.getElementById('counter').innerText = count;
                    }

                    function triggerTestError() {
                      throw new Error("Uncaught TypeError: Cannot read properties of undefined (reading 'renderDemo') at App.tsx:18:24");
                    }

                    // Forward errors to parent IDE frame
                    window.onerror = function(message, source, lineno, colno, error) {
                      if (window.parent) {
                        window.parent.postMessage({
                          type: 'PreviewError',
                          subType: 'Runtime',
                          payload: {
                            message: message,
                            source: source || 'App.tsx',
                            lineno: lineno || 18,
                            colno: colno || 24,
                            stack: error ? error.stack : 'Error: ' + message
                          }
                        }, '*');
                      }
                      return false;
                    };
                  </script>
                </body>
                </html>
                """.formatted(projectName, projectName);
    }

    ///  INTERNAL FUNCTIONS

    public Project getAccessibleProjectById(Long projectId, Long userId) {
        return projectRepository.findAccessibleProjectById(projectId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId.toString()));
    }
}

