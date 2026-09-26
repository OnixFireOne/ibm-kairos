#!/usr/bin/env bash
# Drift B (UNDOCUMENTED_BEHAVIOR): a DELETE endpoint with no OpenAPI entry and no test.
source "$(dirname "$0")/_lib.sh"
in_demo
replace src/store.ts '  get(id: string): Order | undefined {
    return this.orders.get(id);
  }
' '  get(id: string): Order | undefined {
    return this.orders.get(id);
  }

  delete(id: string): boolean {
    return this.orders.delete(id);
  }
'
replace src/routes/orders.ts '    res.json(order);
  });
' '    res.json(order);
  });

  router.delete('"'"'/orders/:id'"'"', (req, res) => {
    if (!store.delete(req.params.id)) {
      res.status(404).json({ error: '"'"'order not found'"'"' });
      return;
    }
    res.status(204).end();
  });
'
commit "Allow cancelling orders"
