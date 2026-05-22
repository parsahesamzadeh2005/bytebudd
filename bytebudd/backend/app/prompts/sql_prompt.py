"""
Prompt templates for the SQL generation LLM.
Includes WordPress, WooCommerce, and PrestaShop context awareness.
"""

# Platform-specific hint snippets injected when relevant table prefixes detected
WORDPRESS_HINTS = """
WordPress/WooCommerce schema hints:
- Posts are in wp_posts (post_type='post' for blog, 'page' for pages, 'product' for WooCommerce products)
- Post metadata is in wp_postmeta (meta_key/meta_value pairs)
- Users are in wp_users, user metadata in wp_usermeta
- WooCommerce orders use post_type='shop_order' in wp_posts
- Order items in wp_woocommerce_order_items, order item metadata in wp_woocommerce_order_itemmeta
- Product prices stored in wp_postmeta with meta_key='_price' or '_regular_price'
- Order totals stored in wp_postmeta with meta_key='_order_total'
- Customer email in wp_postmeta with meta_key='_billing_email'
"""

PRESTASHOP_HINTS = """
PrestaShop schema hints:
- Orders are in ps_orders (current_state references ps_order_state)
- Order line items in ps_order_detail
- Customers in ps_customer
- Products in ps_product, product names/descriptions in ps_product_lang
- Categories in ps_category, category names in ps_category_lang
- Product stock in ps_stock_available
- Revenue: SUM(ps_orders.total_paid) where valid=1
"""


def build_sql_prompt(
    question: str,
    schema: str,
    dialect: str = "ansi",
) -> str:
    """
    Build the full prompt sent to the Ollama model.

    Args:
        question: The user's natural-language question.
        schema: Database schema as text (from connector.get_schema()).
        dialect: SQL dialect hint (postgresql, mysql, sqlite, etc.).

    Returns:
        Formatted prompt string.
    """
    # Auto-detect platform from schema
    platform_hints = ""
    schema_lower = schema.lower()
    if "wp_posts" in schema_lower or "wp_users" in schema_lower:
        platform_hints = WORDPRESS_HINTS
    elif "ps_orders" in schema_lower or "ps_customer" in schema_lower:
        platform_hints = PRESTASHOP_HINTS

    prompt = f"""You are ByteBudd, an expert SQL assistant. Your job is to convert natural language questions into safe, read-only SQL queries.

## Rules (CRITICAL - follow exactly):
1. ONLY generate SELECT statements (or WITH...SELECT CTEs)
2. NEVER use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE
3. Always include LIMIT (max 1000 rows)
4. Use proper {dialect.upper()} syntax
5. Return ONLY the SQL query — no explanations, no markdown, no code fences
6. If the question cannot be answered with the available schema, respond with: ERROR: <reason>

## Database Schema:
{schema}

{platform_hints}

## User Question:
{question}

## SQL Query:"""

    return prompt
