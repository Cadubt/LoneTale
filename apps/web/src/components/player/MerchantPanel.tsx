import type { MerchantView } from '@lonetale/engine';

import { Badge, Button, Panel, PanelTitle } from '../ui';

export function MerchantPanel({
  merchant,
  gold,
  onBuy,
  onSell,
  busy = false,
}: {
  merchant: MerchantView;
  gold: number;
  onBuy: (itemId: string) => void;
  onSell: (itemId: string) => void;
  busy?: boolean;
}) {
  return (
    <Panel>
      <PanelTitle hint={`${gold} ouro`}>
        {merchant.npcName ? `Mercadoria de ${merchant.npcName}` : 'Mercadoria'}
      </PanelTitle>

      {merchant.stock.length === 0 ? (
        <p className="font-ui text-sm text-parchment-400">Nada à venda por aqui.</p>
      ) : (
        <ul className="space-y-2">
          {merchant.stock.map((entry) => (
            <li
              key={entry.itemId}
              className="flex items-center justify-between gap-3 rounded-lg border border-night-800 bg-night-800/40 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-body text-sm text-parchment-50">{entry.name}</span>
                  {entry.quantity >= 0 && <Badge>{entry.quantity} em estoque</Badge>}
                </div>
                {entry.description && (
                  <p className="font-ui text-[12px] text-parchment-400">{entry.description}</p>
                )}
              </div>
              <Button
                size="sm"
                variant={entry.affordable ? 'primary' : 'secondary'}
                disabled={!entry.affordable}
                loading={busy}
                onClick={() => onBuy(entry.itemId)}
                title={entry.affordable ? undefined : 'Ouro insuficiente'}
              >
                {entry.price} ouro
              </Button>
            </li>
          ))}
        </ul>
      )}

      {merchant.buysFromPlayer && merchant.sellable.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 font-display text-xs uppercase tracking-[0.18em] text-parchment-300">
            Vender ({Math.round(merchant.buybackRate * 100)}% do valor)
          </h3>
          <ul className="space-y-2">
            {merchant.sellable.map((entry) => (
              <li
                key={entry.itemId}
                className="flex items-center justify-between gap-3 rounded-lg bg-night-800/30 px-3 py-2"
              >
                <span className="min-w-0 truncate font-body text-sm text-parchment-100">
                  {entry.name}
                  {entry.quantity > 1 && (
                    <span className="ml-1 font-ui text-xs text-parchment-400">×{entry.quantity}</span>
                  )}
                </span>
                <Button size="sm" variant="ghost" loading={busy} onClick={() => onSell(entry.itemId)}>
                  +{entry.price} ouro
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
