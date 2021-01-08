const express = require('express');
const app = express();
const { Pool } = require("pg");
require('dotenv').config();
const bodyParser = require('body-parser');

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "cyf_ecommerce",
    password: process.env.PASSWORD,
    port: 5432,
});

app.use(bodyParser.json());

app.get('/customers', (req, res) => {
    pool.query("select * from customers")
        .then((result) => res.json(result.rows))
        .catch((e) => console.error(e));
});

app.get('/suppliers', (req, res) => {
    pool.query("select * from suppliers")
        .then((result) => res.json(result.rows))
        .catch((e) => console.error(e));
});

// If you don't have it already, add a new GET endpoint `/products` to load all the product names along with their supplier names.
// Update the previous GET endpoint `/products` to filter the list of products by name using a query parameter, for example `/products?name=Cup`. This endpoint should still work even if you don't use the `name` query parameter!
app.get('/products', (req, res) => {
    const name = req.query.name;
    const query = name ? pool.query('SELECT products.product_name, suppliers.supplier_name FROM products JOIN suppliers ON products.supplier_id = suppliers.id WHERE products.product_name = $1', [name])
        : pool.query('SELECT products.product_name, suppliers.supplier_name FROM products JOIN suppliers ON products.supplier_id = suppliers.id')
    query.then((result) => res.json(result.rows))
        .catch((e) => {
            console.error(e)
            res.send(e, 500)
        })
});

// - Add a new GET endpoint `/ customers /: customerId` to load a single customer by ID.
app.get('/customers/:customerId', (req, res) => {
    const { customerId } = req.params;
    pool.query('select * from customers c where c.id = $1', [customerId])
        .then((result) => {
            if (result.rows.length === 0) {
                res.sendStatus(404)
            } else {
                res.json(result.rows[0])
            }
        }
        ).catch((e) => {
            console.error(e)
            res.send(e, 500)
        })
})

// - Add a new POST endpoint `/ customers` to create a new customer.
app.post('/customers', (req, res) => {
    const { name, address, city, country } = req.body;  // Esto viene del json de POSTMAN
    const query = `INSERT INTO orders
    (order_date, order_reference, customer_id)
VALUES
    ('2019-05-10', 'ORD010', 5);`;
    pool.query(query, [name, address, city, country],)
        .then((result) => res.json(result.rows))
});

// - Add a new POST endpoint `/ products` to create a new product (with a product name, a price and a supplier id). Check that the price is a positive integer and that the supplier ID exists in the database, otherwise return an error.
app.post('/products', (req, res) => {
    const { productName, unitPrice, supplierId } = req.body;  // Esto viene del json de POSTMAN
    if (unitPrice > 0) {
        const query = `INSERT INTO products
        (product_name, unit_price, supplier_id) VALUES ($1, $2, $3)`;
        pool.query(query, [productName, unitPrice, supplierId])
            .then((result) => res.json(result.rows))
    } else {
        throw new Error('OOPS! There has been an error! unitPrice must be a positive integer.');
    }
});

/* Add a new POST endpoint `/ customers /: customerId / orders` to create a new order (including an order date, and an 
order reference) for a customer. Check that the customerId 
corresponds to an existing customer or return an error. */
app.post('/customers/:customerId/orders', (req, res) => {
    // Getting data from request
    const { orderReference } = req.body;
    const customerId = req.params.customerId;
    // Validating data
    if (!customerId) {
        res.send('There\'s no customerId')
    } else {
        const customerIdNumber = Number(customerId);
        if (customerIdNumber > 0) {
            const validId = `select c.id from customers c where c.id = $1`;
            pool.query(validId, [customerIdNumber])
                .then((result) => {
                    // ! Esto dice el # d filas del resultado
                    if (result.rowCount > 0) {
                        const query = `INSERT INTO orders
                        (order_date, order_reference, customer_id)
                    VALUES
                        ($1, $2, $3)`
                        pool.query(query, [new Date(), orderReference, customerIdNumber])
                            .then((result) => res.send('You have inserted a new order in the orders table'))
                            .catch((err) => res.send('There was an error during the creation of the order. Please try again'))
                    } else {
                        res.send('The customer does not exist')
                    }
                })
        } else {
            res.send('The customerId is not a positive number')
        }
    }
});


// Add a new PUT endpoint `/ customers /: customerId` to update an existing customer (name, address, city and country).
app.put('/customers/:customerId', (req, res) => {
    const customerId = req.params.customerId;
    const { name, address, city, country } = req.body;
    const query = `update customers 
    SET name=$1, address=$2, city=$3, country=$4 
    WHERE id=$5`;
    pool.query(query, [name, address, city, country, customerId])
        .then(result => res.json(result.rows))
})


// Add a new DELETE endpoint /orders/:orderId to delete an existing order along all the associated order items.
app.delete('/orders/:orderId', (req, res) => {
    const orderId = req.params.orderId;
    const query = `delete from orders where id= $1`;
    pool.query(query, [orderId])
        .then(result => res.json(result.rows))
})

// ! Add a new DELETE endpoint /customers/:customerId to delete an existing customer only if this customer doesn't have orders.
app.delete('/customers/:customerId', (req, res) => {
    const customerId = req.params.customerId;
    const query = `DELETE FROM customers 
    WHERE customers.id NOT IN (
      SELECT orders.customer_id FROM orders
    ) and customers.id = $1`;
    if (customerId) {
        pool.query(query, [customerId])
            .then((result) => res.json(result.rows))
            .catch((e) => console.error(e))
        res.send('Customer Deleted')
    } else {
        res.send('Please add a customerId')
    }
});

// ! Add a new GET endpoint /customers/:customerId/orders to load all the orders along the items in the orders of a specific customer. Especially, the following information should be returned: order references, order dates, product names, unit prices, suppliers and quantities.
app.get('/customers/:customerId/orders', (req, res) => {
    const customerId = req.params.customerId;
    const query = `select o.order_reference, 
	o.order_date, 
	p.product_name,
	oi.quantity,
	customer_id 
from orders o,
    inner join order_items oi on oi.order_id = o.id
    inner join customers c on c.id = o.customer_id
    inner join products p on p.id = oi.product_id 
    where o.customer_id = $1`;
    pool.query(query, [customerId])
        .then((result) => res.json(result.rows))
        .catch((e) => console.error(e))
});

app.listen(process.env.PORT, () => {
    console.log('Listening on port 4000');
})