import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { generateSlug, uploadFile } from "../lib/upload";
import { useAuth } from "../auth/AuthContext";

type CompanyOpt = {
  id: string;
  name: string;
  isPremium?: boolean;
  logo?: string;
  uid?: string;
};

type CategoryOpt = { id: string; name: string };

type FormState = {
  title: string;
  description: string;
  price: string;
  originalPrice: string;
  category: string;
  stock: string;
  unlimitedStock: boolean;
  sku: string;
  weight: string;
  dimensions: string;
  deliveryTime: string;
  minOrder: string;
  isActive: boolean;
  featured: boolean;
  trending: boolean;
  specialOffer: boolean;
  newArrival: boolean;
  industrial: boolean;
  hasFreeShipping: boolean;
  originWarehouseId: string;
};

const EMPTY: FormState = {
  title: "",
  description: "",
  price: "",
  originalPrice: "",
  category: "",
  stock: "10",
  unlimitedStock: false,
  sku: "",
  weight: "",
  dimensions: "",
  deliveryTime: "3-5 jours",
  minOrder: "1",
  isActive: true,
  featured: false,
  trending: false,
  specialOffer: false,
  newArrival: true,
  industrial: false,
  hasFreeShipping: false,
  originWarehouseId: "",
};

async function resolveCategoryId(name: string, existing: CategoryOpt[]): Promise<string> {
  const trimmed = name.trim();
  const found = existing.find(
    (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (found) return found.id;
  const ref = await addDoc(collection(db, "categories"), {
    name: trimmed,
    description: `Catégorie ${trimmed}`,
    imageUrl: null,
    isActive: true,
    productCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return ref.id;
}

export function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id) && id !== "new";
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [categories, setCategories] = useState<CategoryOpt[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [warehouseOptions, setWarehouseOptions] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [coSnap, catSnap, feeSnap] = await Promise.all([
        getDocs(query(collection(db, "companies"), orderBy("name", "asc"))).catch(
          async () => getDocs(collection(db, "companies")),
        ),
        getDocs(collection(db, "categories")),
        getDoc(doc(db, "config", "warehouseFees")).catch(() => null),
      ]);
      setCompanies(
        coSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || "Sans nom"),
            isPremium: Boolean(data.isPremium),
            logo: data.logo as string | undefined,
            uid: (data.uid as string) || d.id,
          };
        }),
      );
      setCategories(
        catSnap.docs.map((d) => ({
          id: d.id,
          name: String(d.data().name || d.id),
        })),
      );
      if (feeSnap && feeSnap.exists()) {
        const list = Array.isArray(feeSnap.data().warehouses)
          ? feeSnap.data().warehouses
          : [];
        setWarehouseOptions(
          list
            .filter((w: { active?: boolean }) => w.active !== false)
            .map((w: { id?: string; label?: string }) => ({
              id: String(w.id || ""),
              label: String(w.label || w.id || ""),
            }))
            .filter((w: { id: string }) => w.id),
        );
      } else {
        setWarehouseOptions([
          { id: "guangzhou", label: "Guangzhou" },
          { id: "yiwu", label: "Yiwu" },
        ]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    void (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "products", id));
        if (!snap.exists()) {
          setError("Produit introuvable.");
          return;
        }
        const data = snap.data();
        setForm({
          title: String(data.name || ""),
          description: String(data.description || ""),
          price: String(data.basePrice ?? data.price ?? ""),
          originalPrice: data.originalPrice != null ? String(data.originalPrice) : "",
          category: String(data.categoryName || ""),
          stock: String(data.stockQuantity ?? 10),
          unlimitedStock: data.unlimitedStock === true,
          sku: String(data.specifications?.modelNumber || ""),
          weight: String(data.specifications?.weight ?? data.weight ?? ""),
          dimensions: String(data.specifications?.dimensions || ""),
          deliveryTime: String(data.deliveryTime || "3-5 jours"),
          minOrder: String(data.minOrder ?? 1),
          isActive: data.isActive !== false,
          featured: Boolean(data.featured),
          trending: Boolean(data.trending),
          specialOffer: Boolean(data.specialOffer),
          newArrival: data.newArrival !== false,
          industrial: Boolean(data.industrial),
          hasFreeShipping: Boolean(data.hasFreeShipping),
          originWarehouseId: (() => {
            const existing = String(data.originWarehouseId || "").trim();
            if (existing) return existing;
            const loadedPrice = Number(data.basePrice ?? data.price ?? 0);
            return Number.isFinite(loadedPrice) && loadedPrice <= 1
              ? "guangzhou"
              : "";
          })(),
        });
        const imgs = Array.isArray(data.images)
          ? data.images.filter((x: unknown) => typeof x === "string")
          : [];
        if (imgs.length) setImages(imgs);
        else if (data.mainImage || data.imageUrl) {
          setImages([String(data.mainImage || data.imageUrl)]);
        }
        if (data.companyId) setCompanyId(String(data.companyId));
      } catch (e) {
        console.error(e);
        setError("Impossible de charger le produit.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (!form.price.trim()) return;
    const n = Number(form.price);
    if (!Number.isFinite(n) || n > 1) return;
    if (form.originWarehouseId.trim()) return;
    patch("originWarehouseId", "guangzhou");
  }, [form.price, form.originWarehouseId]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadFile(file, "products"));
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (e) {
      console.error(e);
      alert("Upload image impossible. Vérifiez Firebase Storage.");
    }
  }

  function addImageUrl() {
    const url = imageUrlInput.trim();
    if (!url) return;
    setImages((prev) => [...prev, url]);
    setImageUrlInput("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.price) {
      setError("Le nom et le prix sont obligatoires.");
      return;
    }
    const price = Number(form.price) || 0;
    if (price <= 1 && !form.originWarehouseId.trim()) {
      setError(
        "Les produits à 0 / 1 FCFA nécessitent un entrepôt d'origine (frais logistique).",
      );
      return;
    }
    const company = companies.find((c) => c.id === companyId);
    if (!company) {
      setError("Choisissez une boutique / un fournisseur.");
      return;
    }
    if (!user) {
      setError("Session expirée.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const uploaded = images.filter(Boolean);
      const stock = Number(form.stock) || 0;
      const categoryId = form.category.trim()
        ? await resolveCategoryId(form.category, categories)
        : "default-category";
      const sellerUid = company.uid || company.id;

      const productData: Record<string, unknown> = {
        name: form.title.trim(),
        nameLower: form.title.trim().toLowerCase(),
        supplier: company.name,
        supplierLower: company.name.toLowerCase(),
        description:
          form.description.trim() || `Découvrez notre produit ${form.title.trim()}`,
        price,
        basePrice: price,
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        currency: "XOF",
        images: uploaded,
        mainImage: uploaded[0] || null,
        imageUrl: uploaded[0] || null,
        categoryId,
        categoryName: form.category.trim() || "Général",
        companyId: company.id,
        companyName: company.name,
        sellerUid,
        creatorId: user.uid,
        sellerId: company.id,
        creatorCompanyId: company.id,
        ownerCompanyId: company.id,
        companyData: {
          id: company.id,
          name: company.name,
          isPremium: company.isPremium || false,
          logo: company.logo || null,
        },
        hasFreeShipping: form.hasFreeShipping,
        freeShippingBadge: form.hasFreeShipping ? "Livraison gratuite" : null,
        isActive: form.isActive,
        status: "published",
        inStock: form.unlimitedStock || stock > 0,
        isVerified: true,
        featured: form.featured,
        trending: form.trending,
        specialOffer: form.specialOffer,
        newArrival: form.newArrival,
        industrial: form.industrial,
        premiumSupplier: company.isPremium || false,
        stockQuantity: stock,
        unlimitedStock: form.unlimitedStock,
        minOrder: Number(form.minOrder) || 1,
        weight: Number.parseFloat(form.weight.replace(",", ".")) || 0,
        shippingCost: 0,
        deliveryTime: form.deliveryTime,
        slug: generateSlug(form.title.trim()),
        updatedAt: new Date(),
        originWarehouseId: form.originWarehouseId.trim() || null,
        originWarehouseLabel:
          warehouseOptions.find((w) => w.id === form.originWarehouseId.trim())
            ?.label || null,
        specifications: {
          modelNumber: form.sku.trim() || `MODEL-${Date.now()}`,
          weight: form.weight.trim(),
          dimensions: form.dimensions.trim(),
        },
      };

      if (isEdit && id) {
        await updateDoc(doc(db, "products", id), productData);
        await addDoc(collection(db, "product_updates"), {
          productId: id,
          updateType: "update",
          updatedAt: new Date(),
          updatedBy: user.uid,
        });
      } else {
        const docRef = doc(collection(db, "products"));
        await setDoc(docRef, {
          ...productData,
          id: docRef.id,
          createdAt: new Date(),
          createdBy: "admin",
          rating: 0,
          reviewCount: 0,
          soldCount: 0,
        });
        await addDoc(collection(db, "product_updates"), {
          productId: docRef.id,
          updateType: "create",
          updatedAt: new Date(),
          updatedBy: user.uid,
        });
      }

      navigate("/products");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Enregistrement du produit impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Chargement du produit…</p>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            <Link to="/products">Produits</Link>
          </p>
          <h1>{isEdit ? "Modifier le produit" : "Nouveau produit"}</h1>
        </div>
      </header>

      {error && <div className="alert danger">{error}</div>}

      <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
        <section className="panel">
          <h2>Informations</h2>
          <label>
            Nom
            <input
              required
              value={form.title}
              onChange={(e) => patch("title", e.target.value)}
            />
          </label>
          <label>
            Description
            <textarea
              rows={5}
              value={form.description}
              onChange={(e) => patch("description", e.target.value)}
            />
          </label>
          <div className="row-2">
            <label>
              Prix (XOF)
              <input
                required
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => patch("price", e.target.value)}
              />
            </label>
            <label>
              Prix barré
              <input
                type="number"
                min="0"
                value={form.originalPrice}
                onChange={(e) => patch("originalPrice", e.target.value)}
              />
            </label>
          </div>
          <div className="row-2">
            <label>
              Stock
              <input
                type="number"
                min="0"
                value={form.stock}
                disabled={form.unlimitedStock}
                onChange={(e) => patch("stock", e.target.value)}
              />
              <span className="check stock-unlimited">
                <input
                  type="checkbox"
                  checked={form.unlimitedStock}
                  onChange={(e) => patch("unlimitedStock", e.target.checked)}
                />
                Stock illimité
              </span>
            </label>
            <label>
              Commande min.
              <input
                type="number"
                min="1"
                value={form.minOrder}
                onChange={(e) => patch("minOrder", e.target.value)}
              />
            </label>
          </div>
          <div className="row-2">
            <label>
              Catégorie
              <input
                list="cats"
                value={form.category}
                onChange={(e) => patch("category", e.target.value)}
                placeholder="Ex. Électronique"
              />
              <datalist id="cats">
                {categories.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </label>
            <label>
              Fournisseur / boutique
              <select
                required
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                <option value="">Sélectionner…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="panel">
          <h2>Photos</h2>
          <div className="image-row">
            {images.map((src) => (
              <div key={src} className="image-chip">
                <img src={src} alt="" />
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => setImages((prev) => prev.filter((x) => x !== src))}
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
          <label>
            Fichiers
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => void onFiles(e.target.files)}
            />
          </label>
          <div className="row-2">
            <label>
              Ou URL image
              <input
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <div className="field-align">
              <button type="button" className="btn" onClick={addImageUrl}>
                Ajouter l’URL
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Logistique</h2>
          <div className="row-2">
            <label>
              SKU / modèle
              <input value={form.sku} onChange={(e) => patch("sku", e.target.value)} />
            </label>
            <label>
              Délai de livraison
              <input
                value={form.deliveryTime}
                onChange={(e) => patch("deliveryTime", e.target.value)}
              />
            </label>
          </div>
          <label>
            Entrepôt d'origine (0 FCFA)
            <select
              value={form.originWarehouseId}
              onChange={(e) => patch("originWarehouseId", e.target.value)}
            >
              <option value="">— Aucun —</option>
              {warehouseOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            Obligatoire pour les produits à 0 / 1 FCFA. Réservé Super-Admin.
          </p>
          <div className="row-2">
            <label>
              Poids
              <input
                value={form.weight}
                onChange={(e) => patch("weight", e.target.value)}
                placeholder="1.2 kg"
              />
            </label>
            <label>
              Dimensions
              <input
                value={form.dimensions}
                onChange={(e) => patch("dimensions", e.target.value)}
                placeholder="30x20x10"
              />
            </label>
          </div>
        </section>

        <section className="panel">
          <h2>Mise en avant</h2>
          <div className="checks">
            {(
              [
                ["isActive", "Actif / publié"],
                ["featured", "Vedette"],
                ["trending", "Tendance"],
                ["specialOffer", "Promo"],
                ["newArrival", "Nouveauté"],
                ["industrial", "Pro / industriel"],
                ["hasFreeShipping", "Livraison gratuite"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="check">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => patch(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <div className="form-actions">
          <Link className="btn" to="/products">
            Annuler
          </Link>
          <button className="btn primary" type="submit" disabled={saving}>
            {saving
              ? "Enregistrement…"
              : isEdit
                ? "Mettre à jour"
                : "Créer le produit"}
          </button>
        </div>
      </form>
    </div>
  );
}
