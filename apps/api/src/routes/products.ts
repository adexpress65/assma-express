import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

/* ================================
   Derniers produits (public)
================================ */
router.get("/latest", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const latest = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return res.json(latest);
  } catch (err: any) {
    console.error("❌ Erreur backend latest:", err);
    return res.status(500).json({
      error: "Impossible de récupérer les produits récents",
    });
  }
});

/* ================================
   Produits par catégorie (public)
================================ */
router.get("/by-category/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const products = await prisma.product.findMany({
      where: { categoryId: id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return res.json(products);
  } catch (err: any) {
    console.error("❌ Erreur backend by-category:", err);
    return res.status(500).json({
      error: "Impossible de récupérer les produits pour cette catégorie",
    });
  }
});

/* ================================
   CREATE Product (auth)
================================ */
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, price, description, categoryId, imageUrl } = req.body;
    if (!name || typeof price !== "number") {
      return res.status(400).json({ error: "Champs invalides (name, price)" });
    }

    const product = await prisma.product.create({
      data: {
        name,
        price,
        description,
        imageUrl,
        categoryId,
        ownerId: req.user!.userId,
      },
    });
    return res.status(201).json(product);
  } catch (e: any) {
    console.error("❌ Erreur create product:", e);
    return res.status(500).json({ error: "Erreur serveur", details: e.message });
  }
});

/* ================================
   LIST Products (auth user only)
================================ */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.product.findMany({
      where: { ownerId: req.user!.userId },
      orderBy: { createdAt: "desc" },
    });
    return res.json(items);
  } catch (e: any) {
    console.error("❌ Erreur list products:", e);
    return res.status(500).json({ error: "Erreur serveur", details: e.message });
  }
});

/* ================================
   GET product by ID (auth user)
================================ */
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findFirst({
      where: { id, ownerId: req.user!.userId },
    });
    if (!product) return res.status(404).json({ error: "Produit introuvable" });
    return res.json(product);
  } catch (e: any) {
    console.error("❌ Erreur get product:", e);
    return res.status(500).json({ error: "Erreur serveur", details: e.message });
  }
});

/* ================================
   UPDATE Product (auth user)
================================ */
router.put("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, price, description, categoryId, imageUrl } = req.body;

    const existing = await prisma.product.findFirst({
      where: { id, ownerId: req.user!.userId },
    });
    if (!existing)
      return res.status(404).json({ error: "Produit introuvable" });

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        price: price ?? existing.price,
        description: description ?? existing.description,
        categoryId: categoryId ?? existing.categoryId,
        imageUrl: imageUrl ?? existing.imageUrl,
      },
    });

    return res.json(product);
  } catch (e: any) {
    console.error("❌ Erreur update product:", e);
    return res.status(500).json({ error: "Erreur serveur", details: e.message });
  }
});

/* ================================
   DELETE Product (auth user)
================================ */
router.delete("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findFirst({
      where: { id, ownerId: req.user!.userId },
    });
    if (!existing)
      return res.status(404).json({ error: "Produit introuvable" });

    await prisma.product.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("❌ Erreur delete product:", e);
    return res.status(500).json({ error: "Erreur serveur", details: e.message });
  }
});

export default router;
