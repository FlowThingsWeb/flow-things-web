# Migraciones

El esquema de la base de la tienda, en el orden en que pasó.

Nada de esto se ejecuta solo: no hay CLI de Supabase conectada ni un paso
de deploy que las corra. Cada archivo se pega a mano en el SQL editor del
proyecto `qnxpnxvnsezccetxigtc`, una vez, cuando entra.

## Por qué están acá y no sólo en Supabase

Son el único plano de la base fuera del panel. El proyecto está en plan
Free: no hay point-in-time recovery y la retención de backups es corta.
El día que se pierda una tabla, esto es con lo que se reconstruye.

Y explican el porqué, que es lo que no se puede deducir mirando el
esquema: por qué una columna es nullable, qué caso roto motivó un
índice, qué pasaba antes de un trigger.

## Cómo se nombran

    YYYYMMDD[letra]_<qué_hace>.sql

La fecha es la del día en que la migración entró. La letra ordena las
del mismo día: la primera no lleva, las siguientes son `b`, `c`, `d`.
Así el orden alfabético es el orden real de ejecución, que importa —
`20260611_setup.sql` crea las tablas sobre las que trabajan todas las
demás.

Hasta noviembre de 2026 vivían sueltas en la raíz del repo, como
`supabase_packs.sql`, sin fecha y sin orden. Se movieron con `git mv`,
así que el historial de cada una sigue entero: `git log --follow` sobre
cualquiera muestra sus cambios desde el día que se escribió.

## Al agregar una

1. Nombre con la fecha de hoy y la letra que corresponda.
2. Arriba, un comentario que diga **por qué**, no qué. El `alter table`
   ya dice qué.
3. Idempotente donde se pueda (`if not exists`, `on conflict do
   nothing`): correrla dos veces no tiene que romper nada.
4. Si el código nuevo lee una columna que agrega esta migración, la
   migración se corre **antes** de deployar. Si no, la tienda tira error
   hasta que exista.
