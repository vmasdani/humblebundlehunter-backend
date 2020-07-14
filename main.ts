import { Application, Router } from "https://deno.land/x/oak@v6.0.0/mod.ts";
import { DB } from "https://deno.land/x/sqlite@v2.1.1/mod.ts";
import { Mutex } from "https://deno.land/x/mutex/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

const dbMut = new Mutex();
const db = new DB("data.db");
const app = new Application();
const router = new Router();

db.query(`create table if not exists donor (
  id integer primary key autoincrement,
  name text,
  contrib integer,
  paid integer
)`);

db.query(`create table if not exists timelimit (
  id integer primary key autoincrement,
  time_limit integer
)`);

db.query(`create table if not exists price (
  id integer primary key autoincrement,
  price integer
)`);

// Initialize price if not exists (15 USD)
const priceList = [];

for (const price of db.query("select * from price")) {
  priceList.push(price);
}

if(priceList.length === 0) {
  db.query("insert into price (price) values (?)", [15]);
}

let priceRow: any[] = [];

for (const price of db.query("select * from price")) {
  priceRow = price;
}

console.log(`Price row:`, priceRow);
const price = priceRow?.length > 1 ? priceRow[1] : 0;
console.log("Price:", price);

// Initialize timelimit if not exists
const timeLimitList = [];

for (const timeLimit of db.query("select * from timelimit")) {
  timeLimitList.push(timeLimit);
}

if(timeLimitList.length === 0) {
  db.query("insert into timelimit (time_limit) values (?)", [ new Date("2020-07-18").getTime() ]);
}

let timeLimitRow = [];

for(const timeLimit of db.query("select * from timelimit")) {
  timeLimitRow = timeLimit;
}

const timeLimit = timeLimitRow.length > 1 ? timeLimitRow[1] : new Date().getTime();

console.log("Time limit row:", timeLimitRow);
console.log("Time limit:", timeLimit);

router
  // Get all donors
  .get("/donors", async ctx => {
    dbMut.lock();

    try {
      const donors = [];
      
      for (const donor of db.query("select * from donor")) {
        donors.push({
          id: donor[0],
          name: donor[1],
          contrib: donor[2],
          paid: donor[3]
        });
      }

      ctx.response.body = donors;
    } finally {
      dbMut.unlock();
    }
  })
  .post("/donors", async ctx => {
    dbMut.lock();
    
    try {
      const body = await ctx.request.body({ type: "json" }).value;
      console.log("Body:", body);
      
      db.query("insert into donor (name, contrib, paid) values (?, ?, 0)", [ body.name ? body.name : "", body.contrib ? body.contrib : 0 ]);
    
      ctx.response.body = "Success!";
    } finally {
      dbMut.unlock();
    }
  })
  // Get time
  .get("/timelimit", async ctx => {
    dbMut.lock();

    try {
      let timeLimit = 0;
      
      for (const timeLimitRow of db.query("select * from timelimit")) {
        timeLimit = timeLimitRow[1];
      }

      ctx.response.body = { timeLimit: timeLimit };
    } finally {
      dbMut.unlock();
    }
  })
  // Get price
  .get("/price", async ctx => {
    dbMut.lock();

    try {
      let price = 0;

      for(const priceRow of db.query("select * from price")) {
        price = priceRow[1];
      }

      ctx.response.body = { price : price };
    } finally {
      dbMut.unlock();
    }
  })

app.use(oakCors());
app.use(router.routes());
app.use(router.allowedMethods());

console.log("Listening!");
await app.listen({ port: 8080 });