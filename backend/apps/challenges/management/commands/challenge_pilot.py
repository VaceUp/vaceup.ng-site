"""An operator-invoked, budgeted pilot records measurements, never invents capacity."""
from datetime import timedelta
import json
from pathlib import Path
import uuid

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from apps.challenges import assessment
from apps.challenges.jobs import _provider_call
from apps.challenges.models import ChallengeJob, ChallengeRound


class Command(BaseCommand):
    help = "Grade representative local evidence using the configured Groq key and record actual usage/latency."

    def add_arguments(self, parser):
        parser.add_argument("--round", required=True)
        parser.add_argument("--samples", required=True, help="JSON list of {category, files:[local paths], explanation}.")
        parser.add_argument("--output", required=True)

    def handle(self, *args, **options):
        try:
            config = assessment.require_configuration()
        except assessment.AssessmentUnavailable as error:
            raise CommandError(str(error))
        round = ChallengeRound.objects.filter(slug=options["round"]).first()
        if not round:
            raise CommandError("Challenge round not found.")
        if round.status in ("frozen", "published"):
            raise CommandError("Run the pilot on an unfrozen draft or open round.")
        path = Path(options["samples"]).resolve()
        try:
            if path.stat().st_size > 100000:
                raise ValueError
            samples = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(samples, list) or not 1 <= len(samples) <= 20:
                raise ValueError
        except (OSError, ValueError):
            raise CommandError("Provide a JSON list containing1..20 representative samples.")
        report = {"round": round.slug, "recorded_at": timezone.now().isoformat(), "model": config["model"],
                  "capacity_certified": False, "notice": "Pilot measurements do not prove deadline throughput or provider quotas.", "samples": []}
        for sample in samples:
            category = round.categories.filter(slug=sample.get("category"), enabled=True).first()
            if not category or not isinstance(sample.get("files"), list) or not 1 <= len(sample["files"]) <= 6:
                raise CommandError("Each sample needs an enabled category and1..6 local evidence files.")
            rubric = assessment.normalized_rubric(category.rubric)
            documents, images, flags = [], [], []
            for index, raw in enumerate(sample["files"]):
                file = (path.parent / str(raw)).resolve()
                if not file.is_file() or not 0 < file.stat().st_size <= assessment.MAX_FILE_BYTES:
                    raise CommandError("A representative file is missing or exceeds the evidence size limit.")
                parsed = assessment.extract_evidence(file.read_bytes(), file.name, str(index))
                documents.append({"id": str(index), "name": file.name, "text": parsed["text"]})
                images += [(str(index), value) for value in parsed["images"]]
                flags += parsed["flags"]
            config = assessment.require_configuration(images=bool(images))
            if len(images) > assessment.MAX_IMAGES:
                raise CommandError("A pilot sample exceeds the supported vision image limit.")
            payload = {"category": category.name, "brief": category.brief[:16000], "requirements": category.requirements,
                       "rubric": rubric, "explanation": str(sample.get("explanation", ""))[:12000], "evidence": documents,
                       "unavailable_or_limited_evidence": flags}
            encoded = json.dumps(payload)
            content = [{"type": "text", "text": encoded}]
            for identifier, image in images:
                content += [{"type": "text", "text": "Evidence image ID: " + identifier}, {"type": "image_url", "image_url": {"url": image}}]
            reservation = len((assessment.SYSTEM_PROMPT + encoded + json.dumps(assessment.grade_schema())).encode()) + len(images) * 2048 + config["max_output"] + 256
            job = ChallengeJob.objects.create(round=round, kind="pilot", dedupe_key="pilot:" + uuid.uuid4().hex,
                status="processing", claimed_at=timezone.now(), lease_expires_at=timezone.now() + timedelta(seconds=180), claim_id=uuid.uuid4())
            try:
                result = _provider_call(job, [{"role": "system", "content": assessment.SYSTEM_PROMPT}, {"role": "user", "content": content}], assessment.grade_schema(), reservation, config)
                criteria, quality = assessment.validate_grade(result["output"], rubric, {"explanation", *[item["id"] for item in documents]})
                report["samples"].append({"category": category.slug, "quality_points": str(quality), "criteria": criteria,
                    "usage": result["usage"], "latency_ms": result["latency_ms"], "flags": flags,
                    "needs_review": bool(flags) or result["output"]["needs_review"]})
                job.status, job.completed_at = "completed", timezone.now()
            except Exception:
                job.status, job.error, job.completed_at = "needs_review", "pilot_did_not_complete", timezone.now()
                job.save()
                raise CommandError("Pilot did not complete. Inspect the job and retained budget reservation; no capacity claim was made.") from None
            job.save()
        output = Path(options["output"]).resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2), encoding="utf-8")
        self.stdout.write(f"Recorded {len(report['samples'])} pilot samples in {output}. Capacity is not certified.")
