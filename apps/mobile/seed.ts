// apps/mobile/seed.ts
import { db } from "./src/config/firebase";
import { collection, addDoc } from "firebase/firestore";

const products = [
  {
    name: "Machine à emballage automatique",
    price: "850 000 F CFA",
    image: "https://i.imgur.com/BjPxksg.png",
    category: "machines-industrie"
  },
  {
    name: "Broyeur de céréales 500kg/h",
    price: "1 200 000 F CFA",
    image: "https://i.imgur.com/QB4vLWa.png",
    category: "machines-industrie"
  },
  {
    name: "Moulin alimentaire inox",
    price: "430 000 F CFA",
    image: "https://i.imgur.com/54wfhal.png",
    category: "machines-industrie"
  },
  {
    name: "Presse huile multi-graines",
    price: "2 750 000 F CFA",
    image: "https://i.imgur.com/RCTIDfE.png",
    category: "machines-industrie"
  },
  {
    name: "Décortiqueuse de riz",
    price: "1 950 000 F CFA",
    image: "https://i.imgur.com/afg0ZQ4.png",
    category: "machines-industrie"
  }
];

async function seed() {
  for (const p of products) {
    await addDoc(collection(db, "products"), p);
    console.log("ADDED:", p.name);
  }
}

seed();
