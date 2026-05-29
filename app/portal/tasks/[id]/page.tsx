import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRole } from "@/lib/auth/role";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { actCompleteTask } from "@/app/actions/tasks";
import { actActivateKitFromForm, actShipReturn } from "@/app/actions/kits";
import { renderQrSvg } from "@/lib/qr";

export default async function ParticipantTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const role = await getRole();
  if (role.kind !== "PARTICIPANT") redirect("/");
  const { id } = await params;

  const task = await prisma.taskInstance.findUnique({
    where: { id },
    include: {
      template: { include: { timepoint: true } },
      participant: {
        include: {
          study: true,
          kits: {
            where: { status: { in: ["DELIVERED", "ACTIVATED", "SHIPPED", "RETURN_SHIPPED"] } },
            include: { lot: { include: { sku: true } } },
            orderBy: { allocatedAt: "desc" },
          },
        },
      },
    },
  });
  if (!task || task.participantId !== role.participantId) notFound();

  const complete = async () => {
    "use server";
    await actCompleteTask(id);
  };
  const shipReturn = async () => {
    "use server";
    const kit = task.participant.kits.find((k) => k.status === "ACTIVATED");
    if (!kit) throw new Error("No activated kit to return");
    await actShipReturn(kit.id);
  };

  return (
    <div className="space-y-6">
      <Link
        href="/portal"
        className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Back
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--color-muted)]">
            {task.template.kind}
          </span>
          <StatusPill status={task.status} />
        </div>
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight">
          {task.template.name}
        </h1>
        {task.template.description && (
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
            {task.template.description}
          </p>
        )}
      </div>

      <div className="rounded-lg bg-[var(--color-surface-2)] px-4 py-3 ring-subtle">
        <dl className="grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              Timepoint
            </dt>
            <dd className="mt-0.5">
              {task.template.timepoint?.name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              Trigger
            </dt>
            <dd className="mt-0.5 font-mono">{task.template.triggerType}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              Due
            </dt>
            <dd className="mt-0.5 font-mono">
              {task.dueAt.toISOString().slice(0, 10)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-muted)]">
              Available since
            </dt>
            <dd className="mt-0.5 font-mono">
              {task.availableAt.toISOString().slice(0, 10)}
            </dd>
          </div>
        </dl>
      </div>

      {task.status === "COMPLETED" ? (
        <div className="rounded-lg bg-[var(--color-status-completed-soft)] px-4 py-4 text-center">
          <div className="font-display text-xl text-[var(--color-status-completed)]">
            Already completed
          </div>
          <div className="mt-1 text-[12px] text-[var(--color-status-completed)]/80">
            {task.completedAt && (
              <>
                On{" "}
                <span className="font-mono">
                  {task.completedAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </>
            )}
          </div>
        </div>
      ) : task.status === "PENDING" ? (
        <div className="rounded-lg bg-[var(--color-status-pending-soft)] px-4 py-4 text-center text-[var(--color-status-pending)]">
          <div className="font-display text-xl">Not yet available</div>
          <div className="mt-1 text-[12px]">
            This task will unlock when its trigger fires.
          </div>
        </div>
      ) : task.template.kind === "KIT_ACTIVATE" ? (
        <KitActivateBody
          deliveredKit={task.participant.kits.find(
            (k) => k.status === "DELIVERED",
          )}
        />
      ) : task.template.kind === "SAMPLE_RETURN" ? (
        <SampleReturnBody onShip={shipReturn} />
      ) : (
        <MockTaskBody kind={task.template.kind} onComplete={complete} />
      )}
    </div>
  );
}

function KitActivateBody({
  deliveredKit,
}: {
  deliveredKit:
    | {
        id: string;
        qrToken: string;
        lot: { sku: { name: string } };
      }
    | undefined;
}) {
  if (!deliveredKit) {
    return (
      <div className="rounded-lg bg-[var(--color-surface-2)] px-4 py-4 text-[13px] text-[var(--color-muted)]">
        Your kit hasn&apos;t been delivered yet. We&apos;ll unlock this task
        the moment the carrier confirms delivery.
      </div>
    );
  }
  const svg = renderQrSvg(deliveredKit.qrToken, 180);
  return (
    <form action={actActivateKitFromForm} className="space-y-4">
      <input type="hidden" name="token" value={deliveredKit.qrToken} />
      <div className="rounded-lg bg-[var(--color-surface)] px-4 py-4 ring-subtle text-center">
        <p className="text-[12px] text-[var(--color-muted)]">
          Your kit ({deliveredKit.lot.sku.name})
        </p>
        <div
          className="mx-auto mt-3 inline-block rounded-md bg-white p-2 ring-subtle"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="mt-3 font-mono text-[12px]">{deliveredKit.qrToken}</p>
        <p className="mt-2 text-[12px] text-[var(--color-muted)]">
          In production this scans via the device camera. Tap below to confirm
          you have the kit.
        </p>
      </div>
      <Button type="submit" size="lg" className="w-full">
        Activate my kit
      </Button>
    </form>
  );
}

function SampleReturnBody({ onShip }: { onShip: () => void }) {
  return (
    <form action={onShip} className="space-y-4">
      <div className="rounded-lg bg-[var(--color-surface)] px-4 py-4 ring-subtle">
        <p className="text-[13px]">
          Pack the labelled tubes back into the kit box, peel off the prepaid
          return label, and drop the kit at any carrier location. Tap below
          once you&apos;ve dropped it off.
        </p>
      </div>
      <Button type="submit" size="lg" className="w-full">
        I&apos;ve shipped the return
      </Button>
    </form>
  );
}

function MockTaskBody({
  kind,
  onComplete,
}: {
  kind: string;
  onComplete: () => void;
}) {
  if (kind === "VISIT") {
    return (
      <form action={onComplete} className="space-y-4">
        <div className="rounded-lg bg-[var(--color-surface)] px-4 py-4 ring-subtle">
          <p className="text-[13px]">
            Your coordinator will join the call at the scheduled time. Click
            below once your visit is complete.
          </p>
        </div>
        <Button type="submit" size="lg" className="w-full">
          Mark visit complete
        </Button>
      </form>
    );
  }
  if (kind === "SAMPLE_COLLECT") {
    return (
      <form action={onComplete} className="space-y-4">
        <div className="rounded-lg bg-[var(--color-surface)] px-4 py-4 ring-subtle text-[13px]">
          <p>
            Follow the labelled tube&apos;s instruction card. Make sure the
            tube barcode matches the one in your kit before sealing.
          </p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-[12.5px] text-[var(--color-ink-2)]">
            <li>Wash hands. Open the labelled tube.</li>
            <li>Swab the underarm in slow circles for 30 seconds.</li>
            <li>Place the swab in the buffer, cap firmly, and shake 5×.</li>
            <li>Return the tube to its slot in the kit.</li>
          </ol>
        </div>
        <Button type="submit" size="lg" className="w-full">
          I collected this sample
        </Button>
      </form>
    );
  }
  return (
    <form action={onComplete} className="space-y-4">
      <div className="rounded-lg bg-[var(--color-surface)] px-4 py-4 ring-subtle">
        <p className="text-[13px] text-[var(--color-ink-2)]">
          This is a mock task body. In the real platform, a survey runtime
          renders the question form here. For the prototype, completing simply
          marks the task complete and triggers any dependent SOE rules.
        </p>
        <label className="mt-4 block text-[12px] text-[var(--color-muted)]">
          Free-text response (optional)
          <textarea
            name="response"
            rows={3}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
            placeholder="Anything to note?"
          />
        </label>
      </div>
      <Button type="submit" size="lg" className="w-full">
        Complete task
      </Button>
    </form>
  );
}
