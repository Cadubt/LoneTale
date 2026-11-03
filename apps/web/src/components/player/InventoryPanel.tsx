import type { InventoryItemView } from '@lonetale/engine';

import { Badge, Button, Panel, PanelTitle } from '../ui';

const KIND_LABELS: Record<string, string> = {
  weapon: 'arma',
  armor: 'armadura',
  shield: 'escudo',
  accessory: 'acessório',
  consumable: 'consumível',
  quest: 'missão',
  misc: 'diverso',
};

export function InventoryPanel({
  items,
  onUse,
  onEquip,
  onUnequip,
  busy = false,
  actionsEnabled = true,
}: {
  items: InventoryItemView[];
  onUse: (itemId: string) => void;
  onEquip: (itemId: string) => void;
  onUnequip: (slot: string) => void;
  busy?: boolean;
  actionsEnabled?: boolean;
}) {
  return (
    <Panel>
      <PanelTitle hint={`${items.length} ${items.length === 1 ? 'item' : 'itens'}`}>
        Inventário
      </PanelTitle>

      {items.length === 0 ? (
        <p className="font-ui text-sm text-ink-400">Você não carrega nada.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const equippable =
              Boolean(item.slot) &&
              item.kind !== 'consumable' &&
              item.kind !== 'quest' &&
              item.kind !== 'misc';

            return (
              <li
                key={item.itemId}
                className="rounded-lg border border-ink-800 bg-ink-800/40 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-body text-sm text-ink-50">{item.name}</span>
                      {item.quantity > 1 && (
                        <span className="font-ui text-xs tabular-nums text-ink-300">
                          ×{item.quantity}
                        </span>
                      )}
                      {item.equipped && <Badge tone="moss">equipado</Badge>}
                      <Badge>{KIND_LABELS[item.kind] ?? item.kind}</Badge>
                    </div>
                    {item.description && (
                      <p className="mt-0.5 font-ui text-[12px] text-ink-400">{item.description}</p>
                    )}
                  </div>
                </div>

                {actionsEnabled && (item.usable || equippable) && (
                  <div className="mt-2 flex gap-2">
                    {item.usable && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy}
                        onClick={() => onUse(item.itemId)}
                      >
                        Usar
                      </Button>
                    )}
                    {equippable && !item.equipped && (
                      <Button size="sm" variant="ghost" loading={busy} onClick={() => onEquip(item.itemId)}>
                        Equipar
                      </Button>
                    )}
                    {equippable && item.equipped && item.slot && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busy}
                        onClick={() => onUnequip(item.slot as string)}
                      >
                        Guardar
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
