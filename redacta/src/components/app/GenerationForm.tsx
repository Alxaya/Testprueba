'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import type { FieldDef } from '@/lib/ai/content-types';
import { generateAction, type ActionState } from '@/app/actions/content';

/**
 * Formulario de generacion.
 *
 * Los campos se construyen a partir de la definicion del formato, no estan
 * escritos a mano: anadir un formato nuevo en `content-types.ts` hace aparecer
 * su formulario sin tocar este componente.
 *
 * Solo recibe datos serializables (la definicion incluye funciones que no
 * cruzan la frontera servidor-cliente).
 */

export type SerializableTypeDef = {
  slug: string;
  label: string;
  emoji: string;
  description: string;
  defaultWords: number;
  fields: FieldDef[];
};

type Props = {
  def: SerializableTypeDef;
  projects: Array<{ id: string; name: string }>;
  quotaExhausted: boolean;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending || disabled}>
      {pending ? 'Generando… (10-25 s)' : '✨ Generar contenido'}
    </button>
  );
}

function Field({ field, defaultWords }: { field: FieldDef; defaultWords: number }) {
  const id = `f-${field.name}`;
  const common = {
    id,
    name: field.name,
    className: 'field',
    required: field.required,
    maxLength: field.maxLength,
  };

  return (
    <div>
      <label className="label" htmlFor={id}>
        {field.label}
        {!field.required && <span className="muted font-normal"> (opcional)</span>}
      </label>

      {field.type === 'textarea' && <textarea {...common} rows={5} placeholder={field.placeholder} />}

      {field.type === 'select' && (
        <select id={id} name={field.name} className="field" defaultValue={field.options?.[0]?.value}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {field.type === 'number' && (
        <input
          {...common}
          type="number"
          min={100}
          max={4000}
          step={50}
          defaultValue={defaultWords}
          placeholder={field.placeholder}
        />
      )}

      {field.type === 'text' && <input {...common} type="text" placeholder={field.placeholder} />}

      {field.help && <p className="muted mt-1.5 text-xs">{field.help}</p>}
    </div>
  );
}

export function GenerationForm({ def, projects, quotaExhausted }: Props) {
  const [state, formAction] = useActionState(generateAction, {} as ActionState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="typeSlug" value={def.slug} />

      {def.fields.map((field) => (
        <Field key={field.name} field={field} defaultWords={def.defaultWords} />
      ))}

      {projects.length > 0 && (
        <div>
          <label className="label" htmlFor="f-project">
            Proyecto <span className="muted font-normal">(opcional)</span>
          </label>
          <select id="f-project" name="projectId" className="field" defaultValue="">
            <option value="">Sin proyecto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {quotaExhausted && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Has agotado las generaciones de este periodo.{' '}
          <Link href="/app/facturacion" className="underline">
            Cambia de plan
          </Link>{' '}
          para seguir creando contenido.
        </div>
      )}

      {state?.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-5">
        <SubmitButton disabled={quotaExhausted} />
        <p className="muted text-xs">Consume 1 generacion de tu cuota.</p>
      </div>
    </form>
  );
}
