import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatPaise } from '@menugo/shared';

describe('Public Restaurant Menu UI Logic & Rendering (Task 09)', () => {
  interface MockCategory {
    id: string;
    name: string;
    description?: string | null;
    sortOrder: number;
  }

  interface MockProduct {
    id: string;
    categoryId?: string | null;
    name: string;
    description?: string | null;
    price: number; // integer paise
    imageUrl?: string | null;
    isVegetarian: boolean;
    isAvailable: boolean;
    sortOrder: number;
  }

  const sampleCategories: MockCategory[] = [
    { id: 'cat-1', name: 'Starters', description: 'Appetizers & finger foods', sortOrder: 1 },
    { id: 'cat-2', name: 'Main Course', description: 'Curries & breads', sortOrder: 2 },
    { id: 'cat-3', name: 'Desserts', description: 'Sweet endings', sortOrder: 3 }
  ];

  const sampleProducts: MockProduct[] = [
    {
      id: 'prod-1',
      categoryId: 'cat-1',
      name: 'Paneer Tikka',
      description: 'Marinated cottage cheese roasted in tandoor',
      price: 26000, // ₹260
      imageUrl: 'https://images.example.com/paneer.jpg',
      isVegetarian: true,
      isAvailable: true,
      sortOrder: 1
    },
    {
      id: 'prod-2',
      categoryId: 'cat-1',
      name: 'Chicken Wings',
      description: 'Spicy peri-peri roasted chicken wings',
      price: 32000, // ₹320
      imageUrl: 'https://images.example.com/wings.jpg',
      isVegetarian: false,
      isAvailable: true,
      sortOrder: 2
    },
    {
      id: 'prod-3',
      categoryId: 'cat-2',
      name: 'Dal Makhani',
      description: 'Slow-cooked black lentils in butter and cream',
      price: 22000, // ₹220
      imageUrl: null,
      isVegetarian: true,
      isAvailable: true,
      sortOrder: 1
    },
    {
      id: 'prod-4',
      categoryId: 'cat-2',
      name: 'Butter Chicken',
      description: 'Tender chicken in velvety tomato and fenugreek gravy',
      price: 38000, // ₹380
      imageUrl: 'https://images.example.com/butter-chicken.jpg',
      isVegetarian: false,
      isAvailable: true,
      sortOrder: 2
    },
    {
      id: 'prod-5',
      categoryId: null, // Uncategorized special
      name: 'Chef Tasting Platter',
      description: 'Assorted appetizers and sampler portions',
      price: 65000, // ₹650
      imageUrl: null,
      isVegetarian: true,
      isAvailable: true,
      sortOrder: 99
    }
  ];

  // Helper matching the UI page filter logic
  function filterProducts(
    products: MockProduct[],
    selectedCategory: string | 'all',
    vegOnly: boolean,
    searchQuery: string
  ): MockProduct[] {
    return products.filter((product) => {
      if (selectedCategory !== 'all' && product.categoryId !== selectedCategory) {
        return false;
      }
      if (vegOnly && !product.isVegetarian) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = product.name.toLowerCase().includes(query);
        const matchesDesc = product.description
          ? product.description.toLowerCase().includes(query)
          : false;
        if (!matchesName && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }

  // Helper matching the UI page section grouping logic
  function categorizeSections(categories: MockCategory[], products: MockProduct[]) {
    const productMap = new Map<string, MockProduct[]>();
    const uncategorizedList: MockProduct[] = [];

    categories.forEach((cat) => {
      productMap.set(cat.id, []);
    });

    products.forEach((product) => {
      if (product.categoryId && productMap.has(product.categoryId)) {
        productMap.get(product.categoryId)!.push(product);
      } else {
        uncategorizedList.push(product);
      }
    });

    const sections = categories
      .filter((cat) => (productMap.get(cat.id)?.length || 0) > 0)
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        products: productMap.get(cat.id)!
      }));

    if (uncategorizedList.length > 0) {
      sections.push({
        id: 'uncategorized',
        name: 'Special Delicacies',
        description: 'Chef signature picks and recommendations',
        products: uncategorizedList
      });
    }

    return sections;
  }

  // ---------------------------------------------------------------------------
  // 1. Currency Formatting without Floating-Point Drift
  // ---------------------------------------------------------------------------
  test('formatPaise accurately formats whole rupee amounts in INR', () => {
    assert.equal(formatPaise(18000), '₹180');
    assert.equal(formatPaise(24000), '₹240');
    assert.equal(formatPaise(0), '₹0');
  });

  test('formatPaise accurately formats fractional paise without float math errors', () => {
    // 180.50 rupees = 18050 paise
    assert.equal(formatPaise(18050), '₹180.50');
    // 99.99 rupees = 9999 paise
    assert.equal(formatPaise(9999), '₹99.99');
    // 50 paise = 50
    assert.equal(formatPaise(50), '₹0.50');
    // 5 paise = 5
    assert.equal(formatPaise(5), '₹0.05');
  });

  test('formatPaise formats large amounts using Indian numbering system', () => {
    // ₹1,50,000 (15000000 paise)
    assert.equal(formatPaise(15000000), '₹1,50,000');
    // ₹10,00,000 (1 crore paise = 10 lakh rupees)
    assert.equal(formatPaise(100000000), '₹10,00,000');
  });

  test('formatPaise handles invalid/NaN/null amounts safely', () => {
    assert.equal(formatPaise(NaN), '₹0');
    assert.equal(formatPaise(null as any), '₹0');
    assert.equal(formatPaise(undefined as any), '₹0');
  });

  // ---------------------------------------------------------------------------
  // 2. Category & Section Grouping Logic
  // ---------------------------------------------------------------------------
  test('Categorizes products and groups them by category order', () => {
    const sections = categorizeSections(sampleCategories, sampleProducts);

    // 2 categories have products (Starters, Main Course) + 1 uncategorized section
    // Desserts has 0 products so it is omitted from rendered sections
    assert.equal(sections.length, 3);
    assert.equal(sections[0]!.id, 'cat-1');
    assert.equal(sections[0]!.name, 'Starters');
    assert.equal(sections[0]!.products.length, 2);

    assert.equal(sections[1]!.id, 'cat-2');
    assert.equal(sections[1]!.name, 'Main Course');
    assert.equal(sections[1]!.products.length, 2);

    assert.equal(sections[2]!.id, 'uncategorized');
    assert.equal(sections[2]!.name, 'Special Delicacies');
    assert.equal(sections[2]!.products.length, 1);
  });

  // ---------------------------------------------------------------------------
  // 3. Search & Veg-Only Client Filtering
  // ---------------------------------------------------------------------------
  test('Filters dishes by search query across name and description', () => {
    // Search by product name
    const tikkaResults = filterProducts(sampleProducts, 'all', false, 'Tikka');
    assert.equal(tikkaResults.length, 1);
    assert.equal(tikkaResults[0]!.id, 'prod-1');

    // Search by ingredient in description (case-insensitive)
    const lentilResults = filterProducts(sampleProducts, 'all', false, 'lentils');
    assert.equal(lentilResults.length, 1);
    assert.equal(lentilResults[0]!.id, 'prod-3');

    // Search with no matches
    const noResults = filterProducts(sampleProducts, 'all', false, 'Sushi');
    assert.equal(noResults.length, 0);
  });

  test('Filters vegetarian dishes strictly when veg-only toggle is active', () => {
    const vegDishes = filterProducts(sampleProducts, 'all', true, '');

    assert.equal(vegDishes.length, 3); // Paneer Tikka, Dal Makhani, Chef Tasting Platter
    assert.ok(vegDishes.every((p) => p.isVegetarian === true));

    // Ensure non-veg dishes are excluded
    const nonVegIds = ['prod-2', 'prod-4'];
    for (const nonVegId of nonVegIds) {
      assert.equal(vegDishes.find((p) => p.id === nonVegId), undefined);
    }
  });

  test('Applies category, veg-only and search filters simultaneously', () => {
    // Starters category + Veg Only
    const vegStarters = filterProducts(sampleProducts, 'cat-1', true, '');
    assert.equal(vegStarters.length, 1);
    assert.equal(vegStarters[0]!.name, 'Paneer Tikka');

    // Main Course + Veg Only + Search for 'lentils'
    const dalSearch = filterProducts(sampleProducts, 'cat-2', true, 'lentils');
    assert.equal(dalSearch.length, 1);
    assert.equal(dalSearch[0]!.name, 'Dal Makhani');

    // Main Course + Veg Only + Search for 'chicken' (Non-veg) -> 0 results
    const chickenSearch = filterProducts(sampleProducts, 'cat-2', true, 'chicken');
    assert.equal(chickenSearch.length, 0);
  });

  // ---------------------------------------------------------------------------
  // 4. UI View States (Loading, Error, Empty)
  // ---------------------------------------------------------------------------
  test('Identifies empty menu state when total product count is zero', () => {
    function resolveViewState(loading: boolean, error: string | null, totalProducts: number) {
      if (loading) return 'LOADING_SKELETON';
      if (error) return 'ERROR_ALERT';
      if (totalProducts === 0) return 'EMPTY_MENU';
      return 'MENU_CONTENT';
    }

    assert.equal(resolveViewState(true, null, 10), 'LOADING_SKELETON');
    assert.equal(resolveViewState(false, 'Network failure', 0), 'ERROR_ALERT');
    assert.equal(resolveViewState(false, null, 0), 'EMPTY_MENU');
    assert.equal(resolveViewState(false, null, 5), 'MENU_CONTENT');
  });

  test('Gracefully handles missing or broken product images', () => {
    function getProductImageDisplay(product: MockProduct, imageErrors: Record<string, boolean>) {
      if (!product.imageUrl || imageErrors[product.id]) {
        return { showPlaceholder: true, src: null };
      }
      return { showPlaceholder: false, src: product.imageUrl };
    }

    // Product without image
    const withoutImg = getProductImageDisplay(sampleProducts[2]!, {});
    assert.equal(withoutImg.showPlaceholder, true);

    // Product with image
    const withImg = getProductImageDisplay(sampleProducts[0]!, {});
    assert.equal(withImg.showPlaceholder, false);
    assert.equal(withImg.src, 'https://images.example.com/paneer.jpg');

    // Product with broken image link
    const brokenImg = getProductImageDisplay(sampleProducts[0]!, { 'prod-1': true });
    assert.equal(brokenImg.showPlaceholder, true);
  });
});

