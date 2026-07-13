import { describe, expect, it } from "vitest";
import { validateTaskInput } from "./validation";

describe("validateTaskInput", () => {
  it("normaliza uma tarefa válida", () => {
    expect(validateTaskInput({ title: "  Retornar cliente  ", priority: "high", status: "pending" }).data).toMatchObject({ title: "Retornar cliente", priority: "high", status: "pending" });
  });

  it("rejeita título vazio e enums desconhecidos", () => {
    expect(validateTaskInput({ title: "" }).error).toBeTruthy();
    expect(validateTaskInput({ title: "Teste", priority: "urgent" }).error).toBe("Prioridade inválida.");
  });

  it("aceita atualizações parciais e rejeita referências inválidas", () => {
    expect(validateTaskInput({ status: "completed" }, true).data).toEqual({ status: "completed" });
    expect(validateTaskInput({ assigned_to: "outra-conta" }, true).error).toContain("assigned_to");
  });
});
