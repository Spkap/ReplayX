"use client";

import { FormEvent, useMemo, useState } from "react";
import { StatusPill } from "../../components/replayx-ui";

type CreateRunResponse = {
  ok?: boolean;
  error?: string;
  incidentWorkspacePath?: string;
  livePath?: string;
};

type NewRunFormProps = {
  accessToken: string | null;
};

const severities = ["sev-2", "sev-1", "sev-3"];
const environments = ["staging", "production", "development"];

export function NewRunForm({ accessToken }: NewRunFormProps) {
  const [text, setText] = useState("");
  const [repoTarget, setRepoTarget] = useState("repo://current-workspace");
  const [serviceTarget, setServiceTarget] = useState("");
  const [environmentTarget, setEnvironmentTarget] = useState(environments[0]);
  const [severity, setSeverity] = useState(severities[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRunEndpoint = useMemo(() => {
    if (!accessToken) {
      return "/api/replayx/runs";
    }

    return `/api/replayx/runs?access=${encodeURIComponent(accessToken)}`;
  }, [accessToken]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!text.trim()) {
      setError("Incident text is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(createRunEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source: "manual",
          text: text.trim(),
          repoTarget: repoTarget.trim() || null,
          serviceTarget: serviceTarget.trim() || null,
          environmentTarget,
          severity
        })
      });
      const payload = (await response.json().catch(() => ({}))) as CreateRunResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? `ReplayX run creation returned ${response.status}`);
      }

      window.location.href = payload.incidentWorkspacePath ?? payload.livePath ?? "/";
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "ReplayX could not create the run.");
      setIsSubmitting(false);
    }
  };

  return (
    <section className="form-panel">
      <div className="evidence-head">
        <div>
          <span className="eyebrow">Incident packet</span>
          <h2 className="panel-title">Create realtime run</h2>
        </div>
        <StatusPill tone="accent">Manual</StatusPill>
      </div>
      <form className="run-form" onSubmit={submit}>
        <label className="field field-full">
          <span>Incident text</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Checkout is overselling inventory after concurrent purchases..."
            rows={7}
            required
          />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>Repo target</span>
            <input
              value={repoTarget}
              onChange={(event) => setRepoTarget(event.target.value)}
              placeholder="repo://current-workspace"
            />
          </label>
          <label className="field">
            <span>Service</span>
            <input
              value={serviceTarget}
              onChange={(event) => setServiceTarget(event.target.value)}
              placeholder="checkout-api"
            />
          </label>
          <label className="field">
            <span>Environment</span>
            <select value={environmentTarget} onChange={(event) => setEnvironmentTarget(event.target.value)}>
              {environments.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Severity</span>
            <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
              {severities.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p className="form-alert">{error}</p> : null}
        <div className="rail-actions">
          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating run" : "Start live incident"}
          </button>
        </div>
      </form>
    </section>
  );
}
