"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { TICK_MS } from "../constants";
import { criarEstadoInicial, gameReducer } from "./reducer";
import { carregarEstadoInicial, salvarEstado } from "./storage";

export function useGameEngine() {
  const [state, dispatch] = useReducer(gameReducer, undefined, criarEstadoInicial);
  // Snapshot do estado da primeiríssima renderização (igual no servidor e no
  // cliente). Assim que o save é carregado, `state` passa a ser um objeto
  // diferente e `carregado` reflete isso sem precisar de um setState extra
  // dentro do efeito de carregamento.
  const [estadoPreCarregamento] = useState(state);
  const carregado = state !== estadoPreCarregamento;

  // Carrega o save (e calcula progresso offline) uma vez, após montar no
  // cliente — evita divergência entre a renderização do servidor e a do
  // navegador, já que localStorage só existe no cliente.
  useEffect(() => {
    const estadoCarregado = carregarEstadoInicial();
    dispatch({ type: "CARREGAR_ESTADO", estado: estadoCarregado });
  }, []);

  useEffect(() => {
    if (!carregado) return;
    const id = setInterval(() => {
      dispatch({ type: "TICK", agora: Date.now() });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [carregado]);

  useEffect(() => {
    if (!carregado) return;
    salvarEstado(state);
  }, [state, carregado]);

  const investirDistrito = useCallback(
    (distritoId: string) => dispatch({ type: "INVESTIR_DISTRITO", distritoId }),
    [],
  );
  const reforcarSeguranca = useCallback(
    (distritoId: string) => dispatch({ type: "REFORCAR_SEGURANCA", distritoId }),
    [],
  );
  const desbloquearDistrito = useCallback(
    (distritoId: string) => dispatch({ type: "DESBLOQUEAR_DISTRITO", distritoId }),
    [],
  );
  const comprarUpgrade = useCallback(
    (upgradeId: string) => dispatch({ type: "COMPRAR_UPGRADE", upgradeId }),
    [],
  );
  const resolverEvento = useCallback(
    (opcaoId: string) => dispatch({ type: "RESOLVER_EVENTO", opcaoId }),
    [],
  );
  const dispensarRelatorioOffline = useCallback(
    () => dispatch({ type: "DISPENSAR_RELATORIO_OFFLINE" }),
    [],
  );
  const reiniciarJogo = useCallback(() => dispatch({ type: "REINICIAR_JOGO" }), []);

  return {
    state,
    carregado,
    investirDistrito,
    reforcarSeguranca,
    desbloquearDistrito,
    comprarUpgrade,
    resolverEvento,
    dispensarRelatorioOffline,
    reiniciarJogo,
  };
}
