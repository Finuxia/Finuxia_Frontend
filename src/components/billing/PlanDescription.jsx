import { htmlToReact } from "../../lib/safeHtml";

/**
 * A plan's description: the formatted one when the plan has it (rebuilt from the server-cleaned HTML as React elements, see lib/safeHtml), else
 * its one plain line.
 */
export default function PlanDescription({ plan }) {
  const rich = plan.descriptionHtml ? htmlToReact(plan.descriptionHtml) : null;
  if (rich && rich.length > 0) {
    return (
      <div
        data-testid="plan-description"
        className="mt-1 text-xs text-slate-500 [&_a]:font-semibold [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_h3]:mt-2 [&_h3]:font-semibold [&_h3]:text-navy [&_h4]:mt-2 [&_h4]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mt-1 [&_ul]:list-disc"
      >
        {rich}
      </div>
    );
  }
  return plan.description ? <p className="mt-1 text-xs text-slate-500">{plan.description}</p> : null;
}
