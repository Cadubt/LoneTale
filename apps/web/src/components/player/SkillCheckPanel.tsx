import type { SkillCheckView } from '@lonetale/engine';

import { Badge, Button, Panel, PanelTitle } from '../ui';

/**
 * Teste de habilidade.
 *
 * O painel mostra o que esta em jogo antes da rolagem (dados, dificuldade e de
 * onde vem cada bonus). A rolagem acontece no servidor.
 */
export function SkillCheckPanel({
  check,
  onRoll,
  busy = false,
}: {
  check: SkillCheckView;
  onRoll: () => void;
  busy?: boolean;
}) {
  return (
    <Panel className="border-arcane-600/40 bg-arcane-600/5">
      <PanelTitle hint={check.attempts > 0 ? `tentativa ${check.attempts + 1}` : undefined}>
        Teste de habilidade
      </PanelTitle>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="arcane">{check.dice}</Badge>
        {check.bonus !== 0 && (
          <Badge tone="arcane">
            {check.bonus > 0 ? '+' : ''}
            {check.bonus} de bônus
          </Badge>
        )}
        <span className="font-ui text-sm text-parchment-300">contra dificuldade</span>
        <Badge tone="gold">{check.difficulty}</Badge>
      </div>

      <p className="mt-2 font-ui text-[13px] text-parchment-400">
        {[
          check.attributeName && `atributo: ${check.attributeName}`,
          check.skillName && `perícia: ${check.skillName}`,
        ]
          .filter(Boolean)
          .join(' · ') || 'rolagem simples'}
      </p>

      <Button variant="primary" size="lg" block className="mt-4" loading={busy} onClick={onRoll}>
        Rolar {check.dice}
      </Button>

      {check.attempts > 0 && check.retryAllowed && (
        <p className="mt-2 font-ui text-[12px] italic text-parchment-400">
          Você pode tentar de novo.
        </p>
      )}
    </Panel>
  );
}
