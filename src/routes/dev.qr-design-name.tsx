import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { buildDefaultDesignName, type QrDest } from "@/lib/qr-design-name";

/**
 * Harness público (dev/E2E) para validar a nomenclatura automática dos designs
 * salvos no editor de QR. Usa exatamente o helper de produção
 * `buildDefaultDesignName`, então cobre a mesma regra que roda em
 * `/app/qr` — sem depender de autenticação.
 */
export const Route = createFileRoute("/dev/qr-design-name")({
  head: () => ({ meta: [{ title: "Dev — QR design name" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: QrDesignNameHarness,
});

function QrDesignNameHarness() {
  const [dest, setDest] = useState<QrDest>("reviews");
  const [designs, setDesigns] = useState<Array<{ name: string; dest: QrDest }>>([]);

  const nextName = buildDefaultDesignName(
    dest,
    designs.filter((d) => d.dest === dest).map((d) => ({ name: d.name })),
  );

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>QR design name harness</h1>
      <label>
        Destino:{" "}
        <select
          data-testid="dest-select"
          value={dest}
          onChange={(e) => setDest(e.target.value as QrDest)}
        >
          <option value="reviews">Avaliação</option>
          <option value="landing">Cartão Fidelidade</option>
          <option value="linktree">Bio Commerce</option>
        </select>
      </label>
      <p>
        Próximo nome: <strong data-testid="next-name">{nextName}</strong>
      </p>
      <button
        type="button"
        data-testid="save-design"
        onClick={() => setDesigns((prev) => [...prev, { name: nextName, dest }])}
      >
        Salvar design
      </button>
      <ul data-testid="designs-list">
        {designs.map((d, i) => (
          <li key={i} data-testid="design-item" data-dest={d.dest}>
            {d.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
