// ======================================
// Pralnya Vdoma
// Services Catalog v1.1
// ======================================

const servicesData = {

    atelier: [
        {
            id: 601,
            name: "Підшити штани / джинси",
            description: "Збереження оригінального низу",
            price: 300,
            category: "atelier"
        },
        {
            id: 602,
            name: "Ремонт шва",
            description: "Відновлення цілісності виробу",
            price: 250,
            category: "atelier"
        },
        {
            id: 603,
            name: "Заміна блискавки",
            description: "Якісна фурнітура (без вартості блискавки)",
            price: 400,
            category: "atelier"
        },
        {
            id: 604,
            name: "Укоротити сукню / спідницю",
            description: "Точний підгін по фігурі",
            price: 450,
            category: "atelier"
        },
        {
            id: 605,
            name: "Вкоротити рукави",
            description: "Точний підгін по фігурі",
            price: 350,
            category: "atelier"
        },
        {
            id: 606,
            name: "Ремонт кишень",
            description: "Відновлення цілісності виробу",
            price: 300,
            category: "atelier"
        },
        {
            id: 607,
            name: "Дрібний ремонт одягу",
            description: "Дрібні виправлення та підгонка",
            price: 200,
            category: "atelier"
        }
    ],

    clothing: [
        {
            id: 1,
            name: "Футболка",
            description: "Прання та професійне сушіння",
            price: 180,
            category: "clothing",
            image: "images/services/tshirt.png"
        },
        {
            id: 2,
            name: "Майка",
            description: "Прання та професійне сушіння",
            price: 170,
            category: "clothing",
            image: "images/services/tanktop.png"
        },
        {
            id: 3,
            name: "Сорочка",
            description: "Прання та прасування",
            price: 250,
            category: "clothing",
            image: "images/services/shirt.png"
        },
        {
            id: 4,
            name: "Блуза",
            description: "Делікатне прання",
            price: 240,
            category: "clothing",
            image: "images/services/blouse.png"
        },
        {
            id: 5,
            name: "Светр",
            description: "Делікатне прання",
            price: 320,
            category: "clothing",
            image: "images/services/sweater.png"
        },
        {
            id: 6,
            name: "Худі",
            description: "Прання та сушіння",
            price: 350,
            category: "clothing",
            image: "images/services/hoodie.png"
        },
        {
            id: 7,
            name: "Джинси",
            description: "Прання та прасування",
            price: 280,
            category: "clothing",
            image: "images/services/jeans.png"
        },
        {
            id: 8,
            name: "Брюки",
            description: "Прання та прасування",
            price: 250,
            category: "clothing",
            image: "images/services/trousers.png"
        },
        {
            id: 9,
            name: "Спідниця",
            description: "Делікатне прання",
            price: 240,
            category: "clothing",
            image: "images/services/skirt.png"
        },
        {
            id: 10,
            name: "Сукня",
            description: "Преміум догляд",
            price: 450,
            category: "clothing",
            image: "images/services/dress.png"
        },
        {
            id: 11,
            name: "Шорти",
            description: "Прання та сушіння",
            price: 180,
            category: "clothing",
            image: "images/services/shorts.png"
        },
        {
            id: 12,
            name: "Світшот",
            description: "Прання та сушіння",
            price: 350,
            category: "clothing",
            image: "images/services/sweatshirt.png"
        },
        {
            id: 13,
            name: "Кофта",
            description: "Делікатне прання",
            price: 350,
            category: "clothing",
            image: "images/services/cardigan.png"
        }
    ],

    outerwear: [
        {
            id: 101,
            name: "Вітровка",
            description: "Професійне очищення",
            price: 650,
            category: "outerwear",
            image: "images/services/windbreaker.png"
        },
        {
            id: 102,
            name: "Куртка",
            description: "Прання та сушіння",
            price: 850,
            category: "outerwear",
            image: "images/services/jacket.png"
        },
        {
            id: 103,
            name: "Пальто",
            description: "Делікатна чистка",
            price: 950,
            category: "outerwear",
            image: "images/services/coat.png"
        },
        {
            id: 104,
            name: "Пуховик короткий",
            description: "Відновлення пуху",
            price: 1200,
            category: "outerwear",
            image: "images/services/down-short.png"
        },
        {
            id: 105,
            name: "Пуховик довгий",
            description: "Premium догляд",
            price: 1450,
            category: "outerwear",
            image: "images/services/down-long.png"
        },
        {
            id: 106,
            name: "Куртка джинсова",
            description: "Професійне очищення",
            price: 780,
            category: "outerwear",
            image: "images/services/denim-jacket.png"
        },
        {
            id: 107,
            name: "Плащ / Тренч",
            description: "Делікатна чистка",
            price: 1000,
            category: "outerwear",
            image: "images/services/trench.png"
        },
        {
            id: 108,
            name: "Жилет",
            description: "Професійне очищення",
            price: 750,
            category: "outerwear",
            image: "images/services/vest.png"
        },
        {
            id: 109,
            name: "Піджак",
            description: "Делікатна чистка",
            price: 750,
            category: "outerwear",
            image: "images/services/blazer.png"
        }
    ],

    textile: [
        {
            id: 201,
            name: "Комплект постелі",
            description: "Прання та прасування",
            price: 550,
            category: "textile",
            image: "images/services/bedding.png"
        },
        {
            id: 202,
            name: "Плед",
            description: "Делікатне прання",
            price: 550,
            category: "textile",
            image: "images/services/plaid.png"
        },
        {
            id: 203,
            name: "Ковдра",
            description: "Глибоке очищення",
            price: 850,
            category: "textile",
            image: "images/services/blanket.png"
        },
        {
            id: 204,
            name: "Подушка",
            description: "Антибактеріальна обробка",
            price: 350,
            category: "textile",
            image: "images/services/pillow.png"
        },
        {
            id: 205,
            name: "Ковдра пухова",
            description: "Преміальний догляд за пуховим наповнювачем",
            price: 1200,
            category: "textile",
            image: "images/services/down-blanket.png"
        },
        {
            id: 206,
            name: "Подушка велика (50х60–70х70)",
            description: "Антибактеріальна обробка",
            price: 700,
            category: "textile",
            image: "images/services/pillow-large.png"
        },
        {
            id: 207,
            name: "М'яка іграшка",
            description: "Дбайливе прання та сушіння",
            price: 550,
            category: "textile",
            image: "images/services/toy.png"
        },
        {
            id: 208,
            name: "Покривало",
            description: "Прання та прасування",
            price: 850,
            category: "textile",
            image: "images/services/bedspread.png"
        },
        {
            id: 209,
            name: "Тюль / органза",
            description: "Ціна за 1 м² — у кількості вкажіть площу виробу в м²",
            price: 220,
            category: "textile",
            image: "images/services/tulle.png"
        },
        {
            id: 210,
            name: "Штори прості",
            description: "Ціна за 1 м² — у кількості вкажіть площу виробу в м²",
            price: 380,
            category: "textile",
            image: "images/services/curtains.png"
        },
        {
            id: 211,
            name: "Штори щільні / на підкладці",
            description: "Ціна за 1 м² — у кількості вкажіть площу виробу в м²",
            price: 480,
            category: "textile",
            image: "images/services/curtains-heavy.png"
        },
        {
            id: 212,
            name: "Рушники",
            description: "Прання та сушіння",
            price: 120,
            category: "textile",
            image: "images/services/towel.png"
        },
        {
            id: 213,
            name: "Халат",
            description: "Прання та сушіння",
            price: 350,
            category: "textile",
            image: "images/services/robe.png"
        },
        {
            id: 214,
            name: "Наматрацник",
            description: "Глибоке очищення",
            price: 800,
            category: "textile",
            image: "images/services/mattress-cover.png"
        }
    ],

    shoes: [
        {
            id: 301,
            name: "Кросівки",
            description: "Комплексне очищення",
            price: 650,
            category: "shoes",
            image: "images/services/sneakers.png"
        },
        {
            id: 302,
            name: "Черевики",
            description: "Професійне очищення",
            price: 850,
            category: "shoes",
            image: "images/services/boots.png"
        }
    ],

    accessories: [
        {
            id: 401,
            name: "Рюкзак",
            description: "Комплексне очищення",
            price: 550,
            category: "accessories",
            image: "images/services/backpack.png"
        },
        {
            id: 402,
            name: "Сумка",
            description: "Делікатне очищення",
            price: 650,
            category: "accessories",
            image: "images/services/bag.png"
        },
        {
            id: 403,
            name: "Краватка",
            description: "Чистка та прасування",
            price: 150,
            category: "accessories",
            image: "images/services/tie.png"
        },
        {
            id: 404,
            name: "Шарф / Хустка",
            description: "Делікатне прання",
            price: 300,
            category: "accessories",
            image: "images/services/scarf.png"
        }
    ],

    aquaclean: [
        {
            id: 501,
            name: "Весільна сукня",
            description: "Premium аквачистка",
            price: 3000,
            category: "aquaclean",
            image: "images/services/wedding.png"
        },
        {
            id: 502,
            name: "Кашемір",
            description: "Делікатна аквачистка",
            price: 650,
            category: "aquaclean",
            image: "images/services/cashmere.png"
        }
    ],

    ironing: [
        {
            id: 701,
            name: "Футболка",
            description: "Тільки прасування, без прання",
            price: 90,
            category: "ironing",
            image: "images/services/iron-tshirt.png"
        },
        {
            id: 702,
            name: "Сорочка",
            description: "Тільки прасування, без прання",
            price: 130,
            category: "ironing",
            image: "images/services/iron-shirt.png"
        },
        {
            id: 703,
            name: "Джинси",
            description: "Тільки прасування, без прання",
            price: 100,
            category: "ironing",
            image: "images/services/iron-jeans.png"
        },
        {
            id: 704,
            name: "Брюки зі стрілками",
            description: "Тільки прасування, без прання",
            price: 180,
            category: "ironing",
            image: "images/services/iron-trousers.png"
        },
        {
            id: 705,
            name: "Спідниця коротка",
            description: "Тільки прасування, без прання",
            price: 100,
            category: "ironing",
            image: "images/services/iron-skirt-short.png"
        },
        {
            id: 706,
            name: "Спідниця довга",
            description: "Тільки прасування, без прання",
            price: 150,
            category: "ironing",
            image: "images/services/iron-skirt-long.png"
        },
        {
            id: 707,
            name: "Сукня",
            description: "Тільки прасування, без прання",
            price: 250,
            category: "ironing",
            image: "images/services/iron-dress.png"
        },
        {
            id: 708,
            name: "Блуза",
            description: "Тільки прасування, без прання",
            price: 180,
            category: "ironing",
            image: "images/services/iron-blouse.png"
        },
        {
            id: 709,
            name: "Кофта / Светр",
            description: "Тільки прасування, без прання",
            price: 200,
            category: "ironing",
            image: "images/services/iron-sweater.png"
        },
        {
            id: 710,
            name: "Краватка",
            description: "Тільки прасування, без прання",
            price: 100,
            category: "ironing",
            image: "images/services/iron-tie.png"
        },
        {
            id: 711,
            name: "Комплект постільної білизни",
            description: "Тільки прасування, без прання",
            price: 200,
            category: "ironing",
            image: "images/services/iron-bedding.png"
        },
        {
            id: 712,
            name: "Піджак",
            description: "Прасування відпарювачем",
            price: 180,
            category: "ironing",
            image: "images/services/iron-blazer.png"
        },
        {
            id: 713,
            name: "Пальто",
            description: "Прасування відпарювачем",
            price: 320,
            category: "ironing",
            image: "images/services/iron-coat.png"
        },
        {
            id: 714,
            name: "Куртка",
            description: "Прасування відпарювачем",
            price: 320,
            category: "ironing",
            image: "images/services/iron-jacket.png"
        }
    ],

    extra: [
        {
            id: 801,
            name: "Виведення плями",
            description: "Ціна за одну пляму",
            price: 80,
            category: "extra",
            image: "images/services/stain.png"
        },
        {
            id: 802,
            name: "Чистка катишків",
            description: "За одну річ",
            price: 100,
            category: "extra",
            image: "images/services/pilling.png"
        },
        {
            id: 803,
            name: "Кондиціонування",
            description: "Додатково до прання, за одне завантаження",
            price: 30,
            category: "extra",
            image: "images/services/conditioner.png"
        },
        {
            id: 804,
            name: "Відбілювання",
            description: "Додатково до прання, за одне завантаження",
            price: 40,
            category: "extra",
            image: "images/services/bleach.png"
        },
        {
            id: 805,
            name: "Накрохмалювання білизни",
            description: "Для комплекту постільної білизни",
            price: 200,
            category: "extra",
            image: "images/services/starch.png"
        }
    ]

};

console.log("✅ services.js успешно загружен");
console.log(servicesData);
