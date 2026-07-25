import type { Metadata } from 'next';
import { requireUserWithOrg } from '@/lib/session';
import { ActionForm } from '@/components/ui/ActionForm';
import { saveBrandProfileAction } from '@/app/actions/account';

export const metadata: Metadata = { title: 'Perfil de marca' };
export const dynamic = 'force-dynamic';

/** Campos del perfil de marca, con ejemplos utiles en el marcador de posicion. */
const fields = [
  {
    name: 'brandName',
    label: 'Nombre de la marca',
    type: 'text' as const,
    placeholder: 'Pelusa',
    help: 'Como quieres que aparezca escrito en los textos.',
    maxLength: 80,
  },
  {
    name: 'sector',
    label: 'Sector',
    type: 'text' as const,
    placeholder: 'Accesorios para mascotas',
    maxLength: 80,
  },
  {
    name: 'audience',
    label: 'Publico objetivo',
    type: 'textarea' as const,
    placeholder:
      'Duenos de perros de pelo largo, 30-55 anos, que compran online y les preocupa la limpieza de casa.',
    help: 'Cuanto mas concreto, mejor. Incluye edad, situacion y que les preocupa.',
    maxLength: 400,
  },
  {
    name: 'toneOfVoice',
    label: 'Tono de voz',
    type: 'text' as const,
    placeholder: 'Cercano, practico y con algo de humor. De tu, nunca de usted.',
    maxLength: 200,
  },
  {
    name: 'valueProps',
    label: 'Propuesta de valor',
    type: 'textarea' as const,
    placeholder: 'Envio en 24 h, devolucion gratis 30 dias, atencion por WhatsApp.',
    help: 'Que te diferencia de la competencia. Solo hechos reales: se usaran tal cual.',
    maxLength: 600,
  },
  {
    name: 'keywords',
    label: 'Palabras clave prioritarias',
    type: 'textarea' as const,
    placeholder: 'cepillo perro pelo largo, quitar pelo sofa, cepillo autolimpiante',
    help: 'Separadas por comas.',
    maxLength: 400,
  },
  {
    name: 'avoid',
    label: 'Que evitar siempre',
    type: 'textarea' as const,
    placeholder: 'No mencionar precios concretos. No prometer resultados veterinarios.',
    help: 'Restricciones legales, promesas prohibidas, palabras vetadas.',
    maxLength: 400,
  },
];

export default async function BrandPage() {
  const { organization } = await requireUserWithOrg();
  const brand = organization.brandProfile;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Perfil de marca</h1>
        <p className="muted mt-1">
          Esto se anade a cada peticion al modelo. Es la diferencia entre contenido generico y
          contenido que suena a tu negocio.
        </p>
      </header>

      <div className="surface p-6">
        <ActionForm action={saveBrandProfileAction} submitLabel="Guardar perfil">
          {fields.map((field) => {
            const value = (brand?.[field.name as keyof typeof brand] as string | null) ?? '';
            const id = `brand-${field.name}`;
            return (
              <div key={field.name}>
                <label className="label" htmlFor={id}>
                  {field.label}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={id}
                    name={field.name}
                    className="field"
                    rows={3}
                    defaultValue={value}
                    placeholder={field.placeholder}
                    maxLength={field.maxLength}
                  />
                ) : (
                  <input
                    id={id}
                    name={field.name}
                    type="text"
                    className="field"
                    defaultValue={value}
                    placeholder={field.placeholder}
                    maxLength={field.maxLength}
                  />
                )}
                {field.help && <p className="muted mt-1.5 text-xs">{field.help}</p>}
              </div>
            );
          })}
        </ActionForm>
      </div>
    </div>
  );
}
