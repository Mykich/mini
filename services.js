// ======================================
// Pralnya Vdoma
// Services Catalog v1.0
// ======================================

const servicesData = {
    // Добавь это внутрь объекта servicesData в services.js:
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

    ]

};
console.log("✅ services.js успешно загружен");
console.log(servicesData);