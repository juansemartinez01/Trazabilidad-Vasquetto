import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


export type ImagesClient = {
  upload(
    buffer: Buffer,
    mime: string,
    filename: string,
    assetId?: string,
  ): Promise<{ url: string; public_id: string }>;
  delete(publicId: string): Promise<{ message: string }>;
  list(): Promise<Array<{ url: string; public_id: string }>>;
};

type UrlsResponse = {
  imageId: string;
  assetId?: string;
  version?: number;
  originalUrl: string;
  variants?: {
    w320?: string;
    w800?: string;
    w1600?: string;
  };
  status?: string;
};

type LatestResponse = {
  id: string; // imageId
  assetId: string;
  version: number;
};


type CreateUploadResponse = {
  imageId: string;
  assetId: string;
  version: number;
  originalKey: string;
  uploadUrl: string;
  headers?: Record<string, string>;
};

function extFromMime(mime: string): 'png' | 'jpeg' | 'pdf' {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpeg';
  if (mime === 'application/pdf') return 'pdf';
  throw new Error(`Unsupported mime: ${mime}`);
}


function buildAuthHeaders(tenantKey: string, apiKey?: string) {
  const h = new Headers();
  h.set('x-tenant-key', tenantKey);
  if (apiKey) h.set('x-api-key', apiKey);
  return h;
}

export const ImagesProvider: Provider = {
  provide: 'IMAGES',
  useFactory: (config: ConfigService): ImagesClient => {
    const base = config.get<string>('IMAGES_API_BASE');
    const tenantKey = config.get<string>('IMAGES_TENANT_KEY');
    const apiKey = config.get<string>('IMAGES_API_KEY');
    const cloudfrontBase = config.get<string>('IMAGES_CLOUDFRONT_BASE'); // opcional, para list()

    if (!base) throw new Error('Missing IMAGES_API_BASE');
    if (!tenantKey) throw new Error('Missing IMAGES_TENANT_KEY');

    

   

    
    if (!apiKey) throw new Error('Missing IMAGES_API_KEY');

    const authHeaders: Record<string, string> = {
      'x-tenant-key': tenantKey,
      'x-api-key': apiKey,
    };

    return {
      async upload(buffer, mime, filename, assetId) {
        const t0 = Date.now();
        const mark = (s: string) =>
          console.log(`[IMAGES] ${s} +${Date.now() - t0}ms`);


        const ext = extFromMime(mime);
        const bytes = buffer.length;


        mark('createUpload start');
        // 1) createUpload
        const createHeaders = new Headers(authHeaders);
        createHeaders.set('Content-Type', 'application/json');

        const createRes = await fetch(`${base}/v1/images/upload`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ext, mime, bytes }),
        });

        const createText = await createRes.text().catch(() => '');
        if (!createRes.ok) {
          throw new Error(
            `createUpload failed: ${createRes.status} ${createText}`,
          );
        }

        const created = JSON.parse(createText);

        mark('createUpload ok');

        
        mark('PUT S3 start');

        // 2) PUT a S3 (presigned PUT) - RESPETAR headers del backend
        const putHeaders: Record<string, string> = {
          ...(created.headers ?? {}),
        };

        // aseguramos Content-Type correcto (si el backend lo fija, lo respetamos)
        putHeaders['Content-Type'] = created.headers?.['Content-Type'] ?? mime;

        const putRes = await fetch(created.uploadUrl, {
          method: 'PUT',
          headers: putHeaders,
          body: buffer as any,
        });

        if (!putRes.ok) {
          const text = await putRes.text().catch(() => '');
          throw new Error(`S3 PUT failed: ${putRes.status} ${text}`);
        }

        mark('PUT S3 ok');

        // 3) complete
        const completeHeaders = new Headers(authHeaders);
        completeHeaders.set('Content-Type', 'application/json');

        const completeRes = await fetch(
          `${base}/v1/images/${created.imageId}/complete`,
          {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          },
        );

        if (!completeRes.ok) throw new Error(await completeRes.text());

        mark('complete ok');

        mark('urls start');
        // 4) urls
        const urlsRes = await fetch(
          `${base}/v1/images/${created.imageId}/urls`,
          {
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
          },
        );
        if (!urlsRes.ok) throw new Error(await urlsRes.text());
        

        const urls = (await urlsRes.json()) as UrlsResponse;

        mark('urls ok');
        
        return {
          url: urls.variants?.w800 ?? urls.originalUrl,
          public_id: created.assetId, // 👈 estable, como cloudinary public_id
        };
      },

      async delete(publicId) {
        // publicId = assetId -> borro latest de ese asset (tu endpoint borra por imageId)
        const latestRes = await fetch(
          `${base}/v1/images/assets/${publicId}/latest`,
          {
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
          },
        );
        if (!latestRes.ok) throw new Error(await latestRes.text());
        const latest = (await latestRes.json()) as LatestResponse;

        const delRes = await fetch(`${base}/v1/images/${latest.id}`, {
          method: 'DELETE',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
        });
        if (!delRes.ok) throw new Error(await delRes.text());

        return { message: 'Image deleted successfully' };
      },

      async list() {
        const res = await fetch(`${base}/v1/images`, {
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(await res.text());
        const rows = (await res.json()) as any[];

        // Si no querés pegarle /urls por cada una (carísimo), armamos w800 directo
        return rows.map((img) => {
          const url = cloudfrontBase
            ? `${cloudfrontBase}/tenants/${img.tenantKey}/assets/${img.assetId}/v_${img.version}/${img.id}/w_800.webp`
            : ''; // si no tenés cloudfrontBase en este backend, devolvé '' o armá con tu CDN

          return {
            url,
            public_id: img.assetId,
          };
        });
      },
    };
  },
  inject: [ConfigService],
};
