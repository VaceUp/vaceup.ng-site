"""Router + wiring for assignments and quizzes (mount under /api/v1/)."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.assignments.views import (
    AssignmentViewSet,
    SubmissionViewSet,
    QuizViewSet,
    QuizAttemptViewSet,
    MCQChoiceListView,
)

router = DefaultRouter()
router.register("assignments", AssignmentViewSet, basename="assignment")
router.register("submissions", SubmissionViewSet, basename="submission")
router.register("quizzes", QuizViewSet, basename="quiz")
router.register("quiz-attempts", QuizAttemptViewSet, basename="quiz-attempt")

urlpatterns = [
    path("", include(router.urls)),
    # MCQ choices for a specific question: GET /api/v1/questions/{question_id}/choices/
    path(
        "questions/<int:question_id>/choices/",
        MCQChoiceListView.as_view(),
        name="question-choices",
    ),
    # Quiz questions: POST /api/v1/quizzes/{pk}/questions/
    path(
        "quizzes/<int:pk>/questions/",
        QuizViewSet.as_view({"post": "question"}),
        name="quiz-questions",
    ),
]