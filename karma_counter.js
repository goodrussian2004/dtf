//максимальное кол-во юзеров в результатах
const $max_users_in_results = 1000;
async function main() {
    let $user = {};
    const $user_link = document.querySelector('.navigation-user-profile__avatar').getAttribute("href");
    const $user_link_words = $user_link.split('/');
    $user.id = $user_link_words[$user_link_words.length-1];
    if (!$user.id) { alert('Не могу получить пользователя. Надо авторизоваться.'); return false; }
    let $log_stats = {
        state: undefined,
        time_start: Date.now(),
        entries_processed: 0,
        comments_processed: 0,
    };
    let $entries_ids = [];
    let $comments_ids = [];
    let $likes_users = {};
    let $dislikes_users = {};
    const response = await fetch('https://api.dtf.ru/v2.31/subsite?id=' + $user.id );
    const response_json = await response.json();

    $user.name = response_json.result.subsite.name;
    $user.avatar_url = "https://leonardo.osnova.io/" + response_json.result.subsite.avatar.data.uuid + "/-/scale_crop/100x100/-/format/webp/";
    $user.rating = response_json.result.subsite.rating;
    $user.total_posts = response_json.result.subsite.counters.entries;
    $user.total_comments = response_json.result.subsite.counters.comments;

    create_modal();
    let table__content__likes = document.getElementById('table__content__likes');
    let table__content__dislikes = document.getElementById('table__content__dislikes');
    let statistic_block = document.getElementById('statistic_block');
    let show_modal_statistic__interval = setInterval(update_modal_statistic, 5000);
    $log_stats.time_start = Date.now();
    await get_data();
    clearInterval(show_modal_statistic__interval);
    update_modal_statistic();   //окончательные результаты

    async function get_data() {
        //получение массива постов
        {
            $log_stats.state = 'get_entries_ids';

            let last_sorting_value = 0;
            let last_id = 0;
            let must_break = null;

            while (true) {

                let link = 'https://api.dtf.ru/v2.31/timeline?sorting=new&subsitesIds=' + $user.id + (last_sorting_value === 0 ? '' : '&lastId=' + last_id + '&lastSortingValue=' + last_sorting_value);

                const response = await fetch(link);
                const response_json = await response.json();

                if (response_json.result === undefined ||
                    response_json.result.items === undefined ||
                    response_json.result.items.length === 0 ||
                    response_json.result.items[response_json.result.items.length - 1].id === last_id) {
                    must_break = true;
                } else {

                    last_sorting_value = response_json.result.lastSortingValue;
                    last_id = response_json.result.lastId;

                    for (let k = 0; k < response_json.result.items.length; k++) {
                        if (response_json.result.items[k]) {
                            if (response_json.result.items[k].type === 'entry') {
                                $entries_ids.push(response_json.result.items[k].data.id);
                            }
                        }
                    }
                }

                if (must_break) break;
            }
        }

        //получение массива комментариев
        {
            $log_stats.state = 'get_comments_ids';

            let last_sorting_value = 0;
            let last_id = 0;
            let must_break = null;

            while (true) {

                let link = 'https://api.dtf.ru/v2.31/comments?sorting=new&subsiteId=' + $user.id + (last_sorting_value === 0 ? '' : '&lastId=' + last_id + '&lastSortingValue=' + last_sorting_value);

                const response = await fetch(link);
                const response_json = await response.json();

                if (response_json.result === undefined ||
                    response_json.result.items === undefined ||
                    response_json.result.items.length === 0 ||
                    response_json.result.items[response_json.result.items.length - 1].id === last_id) {
                    must_break = true;
                } else {

                    last_sorting_value = response_json.result.lastSortingValue;
                    last_id = response_json.result.lastId;

                    for (let k = 0; k < response_json.result.items.length; k++) {
                        if (response_json.result.items[k]) {
                            $comments_ids.push(response_json.result.items[k].id);
                        }
                    }
                }

                if (must_break) break;
            }
        }

        //ищем лайки / дизлайки в постах
        {
            $log_stats.state = 'get_entries_likes';
            for (let i = 0; i < $entries_ids.length; i++) {

                const response = await fetch('https://dtf.ru/vote/get_likers?id=' + $entries_ids[i] + '&type=1&mode=raw');
                const response_json = await response.json();
                const likers = response_json.data.likers;

                if (!likers) continue;

                let obj = undefined;
                Object.keys(likers).forEach(key => {

                    obj = likers[key]['sign'] === 1 ? $likes_users : $dislikes_users;

                    if (obj[key] !== undefined) {
                        obj[key]['counter'] = obj[key]['counter'] + 1;
                    } else {
                        obj[key] = {
                            user_id: key,
                            user_name: likers[key]['user_name'],
                            avatar_url: likers[key]['avatar_url'] + '-/scale_crop/100x100/-/format/webp/',
                            counter: 1
                        };
                    }
                });
                $log_stats.entries_processed = i + 1;
            }
        }

        //ищем лайки / дизлайки в комментах
        {
            $log_stats.state = 'get_comments_likes';
            for (let i = 0; i < $comments_ids.length; i++) {

                const response = await fetch('https://dtf.ru/vote/get_likers?id=' + $comments_ids[i] + '&type=4&mode=raw');
                const response_json = await response.json();
                const likers = response_json.data.likers;

                if (!likers) continue;

                let obj = undefined;
                Object.keys(likers).forEach(key => {

                    obj = likers[key]['sign'] === 1 ? $likes_users : $dislikes_users;

                    if (obj[key] !== undefined) {
                        obj[key]['counter'] = obj[key]['counter'] + 1;
                    } else {
                        obj[key] = {
                            user_id: key,
                            user_name: likers[key]['user_name'],
                            avatar_url: likers[key]['avatar_url'] + '-/scale_crop/100x100/-/format/webp/',
                            counter: 1
                        };
                    }
                });

                $log_stats.comments_processed = i + 1;
            }
        }
        $log_stats.state = 'ready';
    }

    function create_modal() {

        let body = document.querySelector("body");
        let modal = document.createElement("div");
        modal.className = "modal_form__wrapper";

        body.innerHTML = '';
        body.appendChild(modal)

        let tables = [
            {id: 'likes', title: 'Топ крутых котанов', title2: 'Лайки'},
            {id: 'dislikes', title: 'Топ жалких пёселей', title2: 'Дизлайки'},
        ]

        let $innerHTML = `
<div class="modal_form">
    <div class="table__row table__row__user">
        <div class="table__cell">
            <a href="https://dtf.ru/u/${$user.id}" target="_blank" class="subsite">                              
                <div class="subsite__avatar">
                    <img src="${$user.avatar_url}" />
                </div>
                <div class="subsite__name">
                    <p>${$user.name}</p>
                    <p class="positive_rating">+${$user.rating}</p>
                </div>
            </a>
        </div>
        <div class="table__cell statistic_block" id="statistic_block" >
            
        </div> 
    </div>
    <div class="modal_form_colomns__wrapper">`;

        for (let i = 0; i < 2; i++) {
            $innerHTML += `
        <div class="modal_form_colomn modal_form_colomn__${tables[i].id}">
            <h1>${tables[i].title}</h1>
            <div class="table">
                <div class="table__row table__row--header">
                    <div class="table__cell">
                        <strong>Юзер</strong>
                    </div> 
                    <div class="table__cell">
                        <strong>${tables[i].title2}</strong>
                    </div> 
                </div> 
                <div class="table__content__wrapper">
                    <div class="table__content" id="table__content__${tables[i].id}">`;

                $innerHTML += `        
                    </div>    
                </div>    
            </div>    
        </div>`;
        }

        $innerHTML += `   
    </div>    
</div>    
`;
        modal.innerHTML = $innerHTML;

        const style = document.createElement('style');
        style.innerHTML = `
.modal_form { 
    width: 1200px;
    margin: 0 auto;
    padding: 30px;
}
.modal_form_colomns__wrapper {
    display: flex;
}
.modal_form_colomn{
    display: flex;
    flex-direction: column;
}
.modal_form h1 {
    text-align:center;
    font-size:30px;
    margin: 20px 0;
}
.modal_form .table {
    display: flex;
    flex-direction: column;
    font-size: 15px;
    line-height: 1.5em;
    width: 550px;
    height: 750px;
    margin: auto;
}
.table__content {
    display: flex;
    flex-direction: column;
}
.table__row {
    display: -ms-flexbox;
    display: flex;
    align-items: center;
    padding: 5px 0;
}
.table__row:not(:last-child):not(.table__row--header) {
    border-bottom: 1px solid rgba(0,0,0,0.07);
}
.table__cell {
    -ms-flex-preferred-size: 0%;
    flex-basis: 0%;
    -ms-flex-positive: 1;
    flex-grow: 1;
    -ms-flex-negative: 0;
    flex-shrink: 0;
    display: -ms-flexbox;
    display: flex;
    min-width: 0;
}
.table__cell:not(:last-child) {
    padding-right: 12px;
}
.table__cell:nth-child(1) {
    -ms-flex-preferred-size: 50%;
    flex-basis: 50%;
    -ms-flex-negative: 1;
    flex-shrink: 1;
}

.table__cell strong{
    font-weight: bold;
}

.subsite {
    -ms-flex-positive: 1;
    flex-grow: 1;
    min-width: 0;
    display: -ms-flexbox;
    display: flex;
    -ms-flex-align: center;
    align-items: center;
    position: relative;
}
.subsite:hover {
    color: #3766a9;
}
.subsite__rank {
    -ms-flex-negative: 0;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
    margin-right: 12px;
    position: relative;
    display: -ms-flexbox;
    display: flex;
    -ms-flex-pack: center;
    justify-content: center;
}
.subsite__avatar {
    -ms-flex-negative: 0;
    flex-shrink: 0;
    margin-right: 8px;
    width: 30px;
    height: 30px;
    outline: 1px solid rgba(0,0,0,0.1);
    outline-offset: -1px;
    border-radius: 2px;
    background-color: #fff;
}
.subsite__avatar img {
    display: block;
    width: 100%;
    height: 100%;
}
.subsite__name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: bold;
}

.table__row__user .subsite__avatar {
    width: 50px;
    height: 50px;
}
.table__row__user .subsite__name span {
    font-size: 20px;
}
.positive_rating {
    color: #2ea83a;
}
.negative_rating {
    color: #e52e3a;
}
.modal_form_colomn__likes .table__cell:nth-child(2) span {
    color: #2ea83a;
}
.modal_form_colomn__dislikes .table__cell:nth-child(2) span {
    color: #e52e3a;
}
.statistic_block p {
    font-size: 16px;
}
body {overflow: scroll;}

  `;
        document.head.appendChild(style);
    }

    function update_modal_statistic() {

        let $results_likes_users = { ...$likes_users };
        let $results_dislikes_users = { ...$dislikes_users };

        //  {323 => {user_id:323, user_name: 'bla'}, 33 => {user_id:33, user_name: 'bla'} ...  }   ===>  [{user_id:323, user_name: 'bla'}, {user_id:33, user_name: 'bla'} ...  }]
        $results_likes_users = Object.keys($results_likes_users).map(function(k) {
            return $results_likes_users[k];
        });
        //сортируем массив по счётчику
        $results_likes_users = $results_likes_users.sort((a,b)=> (a.counter < b.counter ? 1 : -1));
        //обрезаем по количеству юзеров
        $results_likes_users = $results_likes_users.slice(0, $max_users_in_results);

        //  {323 => {user_id:323, user_name: 'bla'}, 33 => {user_id:33, user_name: 'bla'} ...  }   ===>  [{user_id:323, user_name: 'bla'}, {user_id:33, user_name: 'bla'} ...  }]
        $results_dislikes_users = Object.keys($results_dislikes_users).map(function(k) {
            return $results_dislikes_users[k];
        });
        //сортируем массив по счётчику
        $results_dislikes_users = $results_dislikes_users.sort((a,b)=> (a.counter < b.counter ? 1 : -1));
        //обрезаем по количеству юзеров
        $results_dislikes_users = $results_dislikes_users.slice(0, $max_users_in_results);

        let $tables = [
            {table_elem: table__content__likes, rows: $results_likes_users},
            {table_elem: table__content__dislikes, rows: $results_dislikes_users},
        ]

        for(let i=0; i<2; i++) {
            let $innerHTML = '';
            for (let j=0; j<$tables[i].rows.length; j++) {

                $innerHTML +=`
                    <div class="table__row">
                        <div class="table__cell">
                            <a href="https://dtf.ru/u/${$tables[i].rows[j].user_id}" target="_blank" class="subsite">
                                <span class="subsite__rank">
                                    ${j+1}
                                </span> 
                                <div class="subsite__avatar">
                                    <img src="${$tables[i].rows[j].avatar_url}" />
                                </div> 
                                <div class="subsite__name">
                                    <span>${$tables[i].rows[j].user_name}</span>
                                </div>
                            </a>
                        </div> 
                        <div class="table__cell">
                            <span>${$tables[i].rows[j].counter}</span>
                        </div> 
                    </div>`;
            }
            $tables[i].table_elem.innerHTML = $innerHTML;
        }

        let $log = '';
        let time_needed = 0;
        switch($log_stats.state) {
            case 'get_entries_ids' :
                time_needed = ($user.total_posts +  $user.total_comments) * 1000; //1с на запрос
                $log = `
                Ищем посты пользователя:<br /> найдено ${$entries_ids.length} постов.<br />
                Осталось: ${format_ts( $log_stats.time_start + time_needed - Date.now())}  
                `;
                break;
            case 'get_comments_ids' :
                time_needed = ($user.total_posts +  $user.total_comments) * 1000; //1с на запрос
                $log = `
                Найдено ${$entries_ids.length} постов.<br /> 
                Ищем комментарии пользователя:<br /> найдено ${$comments_ids.length} комментариев.<br />
                Осталось: ${format_ts( $log_stats.time_start + time_needed - Date.now())}   
                `;
                break;
            case 'get_entries_likes' :
            case 'get_comments_likes' :
                time_needed = (Date.now() - $log_stats.time_start) * ($entries_ids.length +  $comments_ids.length) / (Math.max(($log_stats.entries_processed + $log_stats.comments_processed), 1));
                $log = `
                Обработано ${$log_stats.entries_processed}/${$entries_ids.length} постов.<br />
                Обработано ${$log_stats.comments_processed}/${$comments_ids.length} комментариев.<br />
                Осталось: ${format_ts( $log_stats.time_start + time_needed - Date.now())}                
                `;
                break;
            case 'ready' :
                $log = 'Готово!';
                break;
            default :  $log = ''
        }

        statistic_block.innerHTML = `<p>${$log}</p>`;
    }

    function format_ts($ts) {
        let date = new Date($ts);
        let hours = date.getUTCHours();
        let minutes = `0${date.getUTCMinutes()}`.substr(-2);
        let seconds = `0${date.getUTCSeconds()}`.substr(-2);
        return (`${hours}:${minutes}:${seconds}`);
    }
}
await main();