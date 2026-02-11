import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


export type ImagesClient = {
  upload(
    s3TenantKey: string,
    buffer: Buffer,
    mime: string,
    filename: string,
    assetId?: string,
  ): Promise<{ url: string; public_id: string }>;

  delete(s3TenantKey: string, publicId: string): Promise<{ message: string }>;

  list(s3TenantKey: string): Promise<Array<{ url: string; public_id: string }>>;
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

type AllowedExt = 'png' | 'jpg' | 'jpeg' | 'pdf';

function extFromMime(mime: string, filename?: string): AllowedExt {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpeg';
  if (mime === 'application/pdf') return 'pdf';

  // fallback por extensión del nombre (por si algún proxy manda octet-stream)
  const byName = (filename ?? '').toLowerCase();
  if (byName.endsWith('.pdf')) return 'pdf';
  if (byName.endsWith('.png')) return 'png';
  if (byName.endsWith('.jpg')) return 'jpg';
  if (byName.endsWith('.jpeg')) return 'jpeg';

  // si querés permitir solo estos tipos, mejor explotar acá:
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
    
    const apiKey = config.get<string>('IMAGES_API_KEY');
    const cloudfrontBase = config.get<string>('IMAGES_CLOUDFRONT_BASE'); // opcional, para list()

    if (!base) throw new Error('Missing IMAGES_API_BASE');
    

    

   

    
    if (!apiKey) throw new Error('Missing IMAGES_API_KEY');

    const headersFor = (s3TenantKey: string) => ({
      'x-tenant-key': s3TenantKey,
      'x-api-key': apiKey,
    });

    

    return {
      async upload(
        s3TenantKey: string,
        buffer: Buffer,
        mime: string,
        filename: string,
        assetId?: string,
      ) {
        const authHeaders = headersFor(s3TenantKey);

        const t0 = Date.now();
        const mark = (s: string) =>
          console.log(`[IMAGES] ${s} +${Date.now() - t0}ms`);

        const ext = extFromMime(mime, filename);
        const bytes = buffer.length;

        mark('createUpload start');

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

        const created = JSON.parse(createText) as CreateUploadResponse;

        mark('createUpload ok');
        mark('PUT S3 start');

        const putHeaders = new Headers(created.headers ?? {});
        if (!putHeaders.get('Content-Type')) {
          putHeaders.set('Content-Type', mime);
        }

        const putRes = await fetch(created.uploadUrl, {
          method: 'PUT',
          headers: putHeaders as any,
          body: buffer as any,
        });

        if (!putRes.ok) {
          const text = await putRes.text().catch(() => '');
          throw new Error(`S3 PUT failed: ${putRes.status} ${text}`);
        }

        mark('PUT S3 ok');

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
        const urlsRes = await fetch(
          `${base}/v1/images/${created.imageId}/urls`,
          {
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
          },
        );
        if (!urlsRes.ok) throw new Error(await urlsRes.text());

        const urls = (await urlsRes.json()) as UrlsResponse;

        mark('urls ok');

        const isPdf = mime === 'application/pdf';

        return {
          url: isPdf
            ? urls.originalUrl
            : (urls.variants?.w800 ?? urls.originalUrl),
          public_id: created.assetId,
        };
      },

      async delete(s3TenantKey: string, publicId: string) {
        const authHeaders = headersFor(s3TenantKey);

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

      async list(s3TenantKey: string) {
        const authHeaders = headersFor(s3TenantKey);

        const res = await fetch(`${base}/v1/images`, {
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(await res.text());

        const rows = (await res.json()) as any[];

        return rows.map((img) => {
          const url = cloudfrontBase
            ? `${cloudfrontBase}/tenants/${img.tenantKey}/assets/${img.assetId}/v_${img.version}/${img.id}/w_800.webp`
            : '';

          return { url, public_id: img.assetId };
        });
      },
    };

  },
  inject: [ConfigService],
};
